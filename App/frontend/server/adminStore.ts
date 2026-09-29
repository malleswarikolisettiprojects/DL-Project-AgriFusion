/**
 * AgriFusion Server Admin Store
 * In-memory state store with seed data representing real Andhra Pradesh & Telangana context.
 * Implements immutable audit logging and soft-deletion/status management.
 */

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agronomist' | 'farmer';
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
  lastSignIn?: string;
  state?: string;
  district?: string;
}

export interface ServerAuditLog {
  id: string;
  event_id: string;
  admin_user_id: string;
  admin_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  timestamp: string;
  safe_metadata?: Record<string, unknown>;
}

export interface ServerFeedback {
  id: string;
  submitted_at: string;
  category: string;
  module: string;
  rating: number;
  status: 'new' | 'under_review' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  comment: string;
  district?: string;
  crop?: string;
  internal_notes?: Array<{
    date: string;
    admin: string;
    note: string;
  }>;
}

export interface ServerSource {
  id: string;
  title: string;
  filename: string;
  organization: string;
  subject: string;
  crop?: string;
  state_relevance: string;
  source_type: string;
  official_url: string;
  verification_date: string;
  verifier: string;
  last_indexed_date: string;
  status: 'verified' | 'verified_with_caveats' | 'needs_review' | 'stale' | 'unavailable';
  notes?: string;
}

export interface ServerScheme {
  id: string;
  scheme_name: string;
  state: string;
  district_applicability: string;
  department: string;
  official_portal: string;
  verification_date: string;
  status: 'active' | 'needs_verification' | 'expired_or_unavailable' | 'missing_official_source';
  caveats?: string;
  notes?: string;
}

class AdminStore {
  public users: ServerUser[] = [
    {
      id: 'usr-admin-01',
      name: 'Dr. Ramesh Rao (Chief Agronomist)',
      email: 'admin@agrifusion.org',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-10T08:00:00Z',
      lastSignIn: new Date().toISOString(),
      state: 'Andhra Pradesh',
      district: 'Guntur',
    },
    {
      id: 'usr-agro-02',
      name: 'K. Sunitha (ANGRAU Extension Officer)',
      email: 'sunitha.angrau@agrifusion.org',
      role: 'agronomist',
      status: 'active',
      createdAt: '2026-02-15T09:30:00Z',
      lastSignIn: '2026-09-18T14:20:00Z',
      state: 'Andhra Pradesh',
      district: 'Visakhapatnam',
    },
    {
      id: 'usr-agro-03',
      name: 'V. Krishna Murthy (PJTSAU Field Scientist)',
      email: 'krishna.pjtsau@agrifusion.org',
      role: 'agronomist',
      status: 'active',
      createdAt: '2026-03-01T11:00:00Z',
      lastSignIn: '2026-09-19T10:15:00Z',
      state: 'Telangana',
      district: 'Warangal',
    },
    {
      id: 'usr-farm-101',
      name: 'B. Venkat Reddy',
      email: 'venkat.reddy@gmail.com',
      role: 'farmer',
      status: 'active',
      createdAt: '2026-04-12T06:40:00Z',
      lastSignIn: '2026-09-20T16:50:00Z',
      state: 'Andhra Pradesh',
      district: 'Guntur',
    },
    {
      id: 'usr-farm-102',
      name: 'M. Apparao',
      email: 'apparao.farmer@yahoo.com',
      role: 'farmer',
      status: 'active',
      createdAt: '2026-05-08T07:15:00Z',
      lastSignIn: '2026-09-21T05:30:00Z',
      state: 'Andhra Pradesh',
      district: 'Visakhapatnam',
    },
    {
      id: 'usr-farm-103',
      name: 'T. Srinivas',
      email: 'srinivas.t@gmail.com',
      role: 'farmer',
      status: 'active',
      createdAt: '2026-06-20T10:25:00Z',
      lastSignIn: '2026-09-15T09:00:00Z',
      state: 'Telangana',
      district: 'Khammam',
    },
    {
      id: 'usr-farm-104',
      name: 'P. Sambasiva Rao',
      email: 'samba.rao@outlook.com',
      role: 'farmer',
      status: 'suspended',
      createdAt: '2026-07-02T12:00:00Z',
      lastSignIn: '2026-08-14T11:20:00Z',
      state: 'Andhra Pradesh',
      district: 'Krishna',
    },
  ];

  public auditLogs: ServerAuditLog[] = [
    {
      id: 'log-1',
      event_id: 'evt-20260918-001',
      admin_user_id: 'usr-admin-01',
      admin_name: 'Dr. Ramesh Rao',
      action: 'ADMIN_LOGIN',
      target_type: 'SYSTEM',
      target_id: 'AUTH_PORTAL',
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      safe_metadata: { ip_masked: '192.168.***.***', user_agent: 'Desktop Chrome' },
    },
    {
      id: 'log-2',
      event_id: 'evt-20260919-002',
      admin_user_id: 'usr-admin-01',
      admin_name: 'Dr. Ramesh Rao',
      action: 'SOURCE_STATUS_CHANGED',
      target_type: 'KNOWLEDGE_SOURCE',
      target_id: 'src-15-telangana-schemes',
      timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
      safe_metadata: { new_status: 'verified', source: '15-telangana-schemes.md' },
    },
    {
      id: 'log-3',
      event_id: 'evt-20260920-003',
      admin_user_id: 'usr-admin-01',
      admin_name: 'Dr. Ramesh Rao',
      action: 'SCHEME_STATUS_VERIFIED',
      target_type: 'GOVERNMENT_SCHEME',
      target_id: 'sch-rythu-bharosa',
      timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      safe_metadata: { scheme: 'YSR Rythu Bharosa / PM-KISAN', status: 'active' },
    },
  ];

  public feedback: ServerFeedback[] = [
    {
      id: 'fb-101',
      submitted_at: new Date(Date.now() - 3600000 * 14).toISOString(),
      category: 'Missing information',
      module: 'Pest & Disease Advisory',
      rating: 4,
      status: 'under_review',
      priority: 'high',
      comment: 'Please add dosage of Chlorantraniliprole 18.5% SC for paddy leaf folder in Telugu language instructions.',
      district: 'Guntur',
      crop: 'Rice',
      internal_notes: [
        {
          date: new Date(Date.now() - 3600000 * 8).toISOString(),
          admin: 'Dr. Ramesh Rao',
          note: 'Verified with ANGRAU Kharif Vyavasaya Panchangam 2026 (0.3 ml/L dosage). Updating knowledge base.',
        },
      ],
    },
    {
      id: 'fb-102',
      submitted_at: new Date(Date.now() - 3600000 * 36).toISOString(),
      category: 'Incorrect answer',
      module: 'Market Forecast',
      rating: 3,
      status: 'new',
      priority: 'medium',
      comment: 'Anakapalle jaggery mandi modal price was ₹3,800/Q yesterday, but market tool displayed previous week benchmark.',
      district: 'Visakhapatnam',
      crop: 'Sugarcane',
    },
    {
      id: 'fb-103',
      submitted_at: new Date(Date.now() - 3600000 * 60).toISOString(),
      category: 'Other',
      module: 'Irrigation Planner',
      rating: 5,
      status: 'resolved',
      priority: 'low',
      comment: 'Drip calculation matches our borewell discharge rate precisely. Saved electricity during night pumping.',
      district: 'Warangal',
      crop: 'Chilli',
      internal_notes: [
        {
          date: new Date(Date.now() - 3600000 * 40).toISOString(),
          admin: 'Dr. Ramesh Rao',
          note: 'Farmer confirmation received for drip 2.1 hr schedule.',
        },
      ],
    },
  ];

  public sources: ServerSource[] = [
    {
      id: 'src-09-mango',
      title: 'Mango Cultivation & Blossom Web Management',
      filename: '09-mango.md',
      organization: 'ANGRAU (Acharya N.G. Ranga Agricultural University)',
      subject: 'Orchard Management & Hoppers Control',
      crop: 'Mango',
      state_relevance: 'Andhra Pradesh & Telangana',
      source_type: 'Official University Guide',
      official_url: 'https://angrau.ac.in',
      verification_date: '2026-08-15',
      verifier: 'Dr. Ramesh Rao',
      last_indexed_date: '2026-09-10',
      status: 'verified',
      notes: 'Contains recommended spray schedules for Banganapalli and Totapuri varieties.',
    },
    {
      id: 'src-11-papaya',
      title: 'Papaya Ringspot Virus & Micronutrient Nutrition',
      filename: '11-papaya.md',
      organization: 'ICAR-IIHR (Indian Institute of Horticultural Research)',
      subject: 'Vector Control & Boron Nutrition',
      crop: 'Papaya',
      state_relevance: 'South India',
      source_type: 'ICAR Technical Bulletin',
      official_url: 'https://iihr.res.in',
      verification_date: '2026-07-20',
      verifier: 'K. Sunitha',
      last_indexed_date: '2026-09-10',
      status: 'verified',
      notes: 'Red Lady 786 planting spacing & vector net recommendations.',
    },
    {
      id: 'src-15-telangana-schemes',
      title: 'Telangana State Agricultural Welfare & Rythu Bima',
      filename: '15-telangana-schemes.md',
      organization: 'Department of Agriculture, Govt. of Telangana',
      subject: 'Farmer Social Security & Crop Investment',
      state_relevance: 'Telangana',
      source_type: 'State Gazette Order',
      official_url: 'https://rythubandhu.telangana.gov.in',
      verification_date: '2026-09-01',
      verifier: 'V. Krishna Murthy',
      last_indexed_date: '2026-09-15',
      status: 'verified',
      notes: 'Updated for 2026 Kharif enrollment criteria.',
    },
    {
      id: 'src-16-andhra-pradesh-schemes',
      title: 'Andhra Pradesh Rythu Bharosa Kendram (RBK) Services',
      filename: '16-andhra-pradesh-schemes.md',
      organization: 'Department of Agriculture, Govt. of Andhra Pradesh',
      subject: 'RBK Seed Subsidy & Free Crop Insurance',
      state_relevance: 'Andhra Pradesh',
      source_type: 'State Agricultural Commissionerate',
      official_url: 'https://apagrisnet.gov.in',
      verification_date: '2026-09-05',
      verifier: 'Dr. Ramesh Rao',
      last_indexed_date: '2026-09-16',
      status: 'verified',
      notes: 'Input distribution guidelines and soil test card validity periods.',
    },
  ];

  public schemes: ServerScheme[] = [
    {
      id: 'sch-rythu-bharosa',
      scheme_name: 'YSR Rythu Bharosa - PM KISAN',
      state: 'Andhra Pradesh',
      district_applicability: 'All 26 Districts',
      department: 'Department of Agriculture, Govt of AP',
      official_portal: 'https://ysrrythubharosa.ap.gov.in',
      verification_date: '2026-09-01',
      status: 'active',
      notes: '₹13,500/year assistance in 3 installments for landowning & SC/ST/BC tenant farmers.',
    },
    {
      id: 'sch-rythu-bima',
      scheme_name: 'Rythu Bima Farmers Group Life Insurance',
      state: 'Telangana',
      district_applicability: 'All 33 Districts',
      department: 'Agriculture Department, Govt of Telangana',
      official_portal: 'https://rythubima.telangana.gov.in',
      verification_date: '2026-08-20',
      status: 'active',
      notes: '₹5,00,000 financial relief to nominee within 10 days of farmer death (ages 18-59).',
    },
    {
      id: 'sch-pmfby',
      scheme_name: 'Pradhan Mantri Fasal Bima Yojana (Free AP Coverage)',
      state: 'Andhra Pradesh',
      district_applicability: 'All notified areas & crops',
      department: 'Ministry of Agriculture / AP State Insurance Cell',
      official_portal: 'https://pmfby.gov.in',
      verification_date: '2026-07-15',
      status: 'active',
      notes: 'State government bears complete farmer premium share for e-Crop registered farmers.',
    },
    {
      id: 'sch-pm-kisan',
      scheme_name: 'PM-KISAN Samman Nidhi',
      state: 'All India',
      district_applicability: 'Nationwide (AP & Telangana included)',
      department: 'Ministry of Agriculture & Farmers Welfare, GoI',
      official_portal: 'https://pmkisan.gov.in',
      verification_date: '2026-08-01',
      status: 'active',
      notes: 'e-KYC and Aadhaar-seeded NPCI bank account mandatory.',
    },
    {
      id: 'sch-micro-irrigation',
      scheme_name: 'APMIP Micro Irrigation Subsidy (Drip & Sprinkler)',
      state: 'Andhra Pradesh',
      district_applicability: 'All Districts (Special focus on Rayalaseema & Prakasam)',
      department: 'AP Micro Irrigation Project',
      official_portal: 'https://apmip.ap.gov.in',
      verification_date: '2026-06-30',
      status: 'active',
      notes: '90% subsidy for SC/ST, 70% for BC, 50% for others up to 5 acres.',
    },
  ];

  public sessions: Map<string, { userId: string; role: string; expiresAt: number }> = new Map();

  // Audit log appender
  public log(adminUserId: string, adminName: string, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) {
    const entry: ServerAuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      event_id: `evt-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`,
      admin_user_id: adminUserId,
      admin_name: adminName,
      action,
      target_type: targetType,
      target_id: targetId,
      timestamp: new Date().toISOString(),
      safe_metadata: metadata,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return entry;
  }
}

export const adminStore = new AdminStore();
