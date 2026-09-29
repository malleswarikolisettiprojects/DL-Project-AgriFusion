import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { AdminApiError, getAdminUsers, updateUserRole, updateUserStatus } from '../../lib/adminApi';
import type { AdminUser } from '../../types';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { ConfirmActionDialog } from '../../components/admin/ConfirmActionDialog';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';

type ResponseState =
  | 'idle'
  | 'loading'
  | 'success'
  | '401'
  | '403'
  | '404'
  | 'network_error'
  | 'server_error'
  | 'malformed_error'
  | 'generic_error';

export const AdminUsersSection: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [responseState, setResponseState] = useState<ResponseState>('loading');
  const [authError, setAuthError] = useState<{ code: number; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAuthError(null);
    setActionSuccessMsg(null);

    try {
      const res = await getAdminUsers({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
      });

      setUsers(res.items || []);
      setTotalUsers(typeof res.total === 'number' ? res.total : (res.items ? res.items.length : 0));
      setResponseState('success');
    } catch (err: unknown) {
      setUsers([]);
      setTotalUsers(0);

      if (err instanceof AdminApiError) {
        if (err.status === 401) {
          setResponseState('401');
          setAuthError({
            code: 401,
            message: err.message || 'Your session has expired. Please sign in again.',
          });
        } else if (err.status === 403) {
          setResponseState('403');
          setAuthError({
            code: 403,
            message: err.message || 'You are signed in, but you do not have administrator permissions.',
          });
        } else if (err.status === 404 || err.message?.includes('not available yet')) {
          setResponseState('404');
        } else if (err.status === 0 || err.message?.includes('Network/CORS') || err.message?.includes('Failed to connect')) {
          setResponseState('network_error');
          setErrorMessage(err.message || 'Failed to connect to backend server due to a network or CORS issue.');
        } else if (err.message?.includes('Unexpected API response')) {
          setResponseState('malformed_error');
          setErrorMessage('Unexpected API response structure: Missing items array in paginated response.');
        } else if (err.status >= 500) {
          setResponseState('server_error');
          setErrorMessage(err.message || 'The backend encountered an internal server error.');
        } else {
          setResponseState('generic_error');
          setErrorMessage(err.message || 'Failed to fetch user directory.');
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to connect to backend server.';
        setResponseState('network_error');
        setErrorMessage(`Network or connection error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm.trim() || roleFilter !== 'all' || statusFilter !== 'all');

  const handleStatusChange = (user: AdminUser, newStatus: 'active' | 'suspended' | 'archived') => {
    const isDestructive = newStatus === 'suspended' || newStatus === 'archived';
    setConfirmDialog({
      isOpen: true,
      title: `${newStatus === 'active' ? 'Restore' : 'Suspend'} User Account`,
      message: `Are you sure you want to change status of account "${user.email || user.id}" to "${newStatus}"? This action will be recorded in the audit trail.`,
      confirmLabel: `${newStatus === 'active' ? 'Restore User' : 'Suspend User'}`,
      isDestructive,
      action: async () => {
        setActionLoading(true);
        try {
          await updateUserStatus(user.id, newStatus);
          setActionSuccessMsg(`Account status updated to ${newStatus} for ${user.email || user.id}`);
          await fetchUsers();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update user status.';
          setErrorMessage(msg);
        } finally {
          setActionLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRoleChange = (user: AdminUser, newRole: string) => {
    setConfirmDialog({
      isOpen: true,
      title: `Assign Role: ${newRole.toUpperCase()}`,
      message: `Are you sure you want to change the RBAC role of "${user.email || user.id}" from "${user.role}" to "${newRole}"? High-privilege role changes must follow security policies.`,
      confirmLabel: 'Confirm Role Assignment',
      isDestructive: newRole === 'admin' || newRole === 'super_admin',
      action: async () => {
        setActionLoading(true);
        try {
          await updateUserRole(user.id, newRole);
          setActionSuccessMsg(`Role updated to ${newRole} for ${user.email || user.id}`);
          await fetchUsers();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update role.';
          setErrorMessage(msg);
        } finally {
          setActionLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const totalPages = Math.ceil(totalUsers / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172018]">User Directory Analytics</h2>
              {responseState === 'success' && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Total: {totalUsers}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Read-only user directory and role distribution analytics across platform registrations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#14532D]' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Users'}</span>
        </button>
      </div>

      {/* Role & Status Summary Cards */}
      {responseState === 'success' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Users</span>
            <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">{totalUsers}</span>
            <span className="text-[10px] text-stone-500 mt-1 block font-medium">Registered Platform Accounts</span>
          </div>

          <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-xs bg-gradient-to-br from-purple-50/40 via-white to-white">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Farmers</span>
            <span className="text-2xl font-extrabold text-purple-950 mt-0.5 block">
              {users.filter(u => u.role === 'farmer' || !u.role).length}
            </span>
            <span className="text-[10px] text-purple-700 mt-1 block font-medium">Primary Agricultural Users</span>
          </div>

          <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs bg-gradient-to-br from-emerald-50/40 via-white to-white">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Agronomists / Experts</span>
            <span className="text-2xl font-extrabold text-emerald-950 mt-0.5 block">
              {users.filter(u => u.role === 'agronomist').length}
            </span>
            <span className="text-[10px] text-emerald-700 mt-1 block font-medium">Extension Specialists</span>
          </div>

          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Administrators</span>
            <span className="text-2xl font-extrabold text-stone-900 mt-0.5 block">
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </span>
            <span className="text-[10px] text-stone-500 mt-1 block font-medium">Platform Management</span>
          </div>
        </div>
      )}

      {/* Success Feedback Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 401 Session Expired Banner */}
      {responseState === '401' && authError && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
            <span>Authentication Failed (401)</span>
          </div>
          <p className="text-xs text-amber-800">{authError.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-colors cursor-pointer"
          >
            Sign in Again
          </button>
        </div>
      )}

      {/* 403 Forbidden Banner */}
      {responseState === '403' && authError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Shield className="w-5 h-5 text-rose-700 shrink-0" />
            <span>Access Denied (403)</span>
          </div>
          <p className="text-xs text-rose-800">{authError.message}</p>
        </div>
      )}

      {/* Network or CORS Error Banner */}
      {responseState === 'network_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Network or CORS Connection Error</span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            {errorMessage || 'Failed to connect to backend server. Check CORS configuration or network connectivity.'}
          </p>
        </div>
      )}

      {/* Server Error (500, 502, 503) Banner */}
      {responseState === 'server_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Server Error</span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            {errorMessage || 'The backend encountered an internal server error.'}
          </p>
        </div>
      )}

      {/* Malformed / Unexpected API Response Banner */}
      {responseState === 'malformed_error' && (
        <div className="p-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <span>Unexpected API Response</span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            The backend returned an unexpected response structure that could not be parsed as a paginated user list.
            Expected JSON format: <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-semibold">&#123; "items": [...], "page": 1, "page_size": 25, "total": 100 &#125;</code>
          </p>
        </div>
      )}

      {/* Generic Error Banner */}
      {responseState === 'generic_error' && (
        <div className="p-5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>User Request Failed</span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
          <p className="text-xs text-rose-800">{errorMessage || 'An error occurred while fetching user data.'}</p>
        </div>
      )}

      {/* API Unavailable (404) State */}
      {responseState === '404' ? (
        <AdminEmptyState
          title="User-management API is not available yet."
          description="The frontend user management interface is built and awaiting backend deployment of GET /api/v1/admin/users and PATCH /api/v1/admin/users/{id}."
          note="FastAPI required routes: GET /api/v1/admin/users, PATCH /api/v1/admin/users/{user_id}/status, PATCH /api/v1/admin/users/{user_id}/role"
          action={{
            label: 'Check API Again',
            onClick: fetchUsers,
          }}
        />
      ) : (responseState === 'success' || responseState === 'loading') && (
        <>
          {/* Controls: Search & Filters */}
          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="p-4 bg-white border border-stone-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ID, email, name..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#14532D]/30"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                  <Filter className="w-3.5 h-3.5 text-stone-400" />
                  <span>Role:</span>
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="agronomist">Agronomist</option>
                  <option value="farmer">Farmer</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-stone-600 ml-2">
                  <span>Status:</span>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#14532D] text-white font-semibold text-xs rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Active Filters Bar */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-stone-100/80 border border-stone-200 rounded-xl text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-stone-600 text-[11px] uppercase tracking-wider">
                    Active Filters:
                  </span>
                  {searchTerm.trim() && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Search: "{searchTerm.trim()}"
                    </span>
                  )}
                  {roleFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Role: {roleFilter}
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-white border border-stone-300 rounded-md font-medium text-stone-800 text-[11px]">
                      Status: {statusFilter}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-semibold text-[#14532D] hover:text-[#16A34A] transition-colors cursor-pointer underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#14532D]" />
                <span>Loading users directory...</span>
              </div>
            ) : responseState === 'success' && users.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500 space-y-3">
                <p className="font-semibold text-stone-700 text-sm">No users match</p>
                <p className="text-stone-500">
                  {hasActiveFilters
                    ? 'No registered accounts match the selected search or filter criteria.'
                    : 'No user accounts were found in the database directory.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-stone-600" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User ID & Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Created / Sign-in</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {users.map((u) => {
                      const lastSignInDate = u.last_sign_in_at || u.last_sign_in;
                      return (
                        <tr key={u.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-stone-900">{u.name || 'Anonymous User'}</div>
                            <div className="font-mono text-[10px] text-stone-400 truncate max-w-[140px]">
                              {u.id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {u.email || <span className="text-stone-400 italic">Not authorized</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-500 text-[11px]">
                            <div>Created: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</div>
                            <div className="text-[10px] text-stone-400">
                              Last: {lastSignInDate ? new Date(lastSignInDate).toLocaleDateString() : 'Never'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <AdminStatusBadge status={u.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {responseState === 'success' && users.length > 0 && (
              <div className="p-4 border-t border-stone-100">
                <AdminPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalUsers}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmActionDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        isDestructive={confirmDialog.isDestructive}
        isLoading={actionLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
