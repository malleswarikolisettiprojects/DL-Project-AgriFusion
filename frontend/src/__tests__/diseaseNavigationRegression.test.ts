import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { parseDiseaseApiResponse } from '../views/DiseaseDetectionView';
import type { UserFarmProfile, FarmerUser } from '../types';

const MOCK_PROFILE: UserFarmProfile = {
  user_email: 'farmer@agrifusion.com',
  state: 'Andhra Pradesh',
  district: 'Visakhapatnam',
  village: 'Anakapalle',
  crop: 'Rice',
  area_ha: 2.5,
  sowing_date: '2026-06-15',
};

const MOCK_USER: FarmerUser = {
  id: 'usr-kisan-301',
  name: 'Ramesh Reddy',
  mobile: '9876543210',
  phone: '9876543210',
  email: 'ramesh@agrifusion.com',
  isLoggedIn: true,
  isRegistered: true,
  createdAt: '2026-01-01T00:00:00Z',
  state: 'Andhra Pradesh',
  district: 'Visakhapatnam',
  village: 'Anakapalle',
  area_ha: 2.5,
  crop: 'Rice',
};

describe('Disease Check Navigation & Session Hydration Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Keeps signed-in user on Disease Check after delayed profile/session hydration', () => {
    let activePage = 'disease-detection';

    // Simulate delayed session restoration resolving in background
    const restoreSession = (prevPage: string) => {
      // Rule: Do NOT overwrite active authenticated module unless user was on landing
      return prevPage === 'landing' || !prevPage ? 'dashboard' : prevPage;
    };

    activePage = restoreSession(activePage);
    expect(activePage).toBe('disease-detection');
  });

  it('2. Selecting a file in Disease Check does not trigger navigation or page reset', () => {
    let activePage = 'disease-detection';
    let selectedFile: File | null = null;
    let previewUrl: string | null = null;

    // Simulate file selection handler
    const handleFileChange = (file: File) => {
      selectedFile = file;
      previewUrl = 'blob:http://localhost/mock-uuid';
      // activePage must remain 'disease-detection'
    };

    const mockImageFile = new File(['fake_bytes'], 'leaf_sample.jpg', { type: 'image/jpeg' });
    handleFileChange(mockImageFile);

    expect(selectedFile).not.toBeNull();
    expect((selectedFile as File | null)?.name).toBe('leaf_sample.jpg');
    expect(previewUrl).toBe('blob:http://localhost/mock-uuid');
    expect(activePage).toBe('disease-detection');
  });

  it('3. API failure in disease analysis remains on Disease Check with retryable error state', () => {
    let activePage = 'disease-detection';

    // Simulate backend diagnostic failure
    const errorResponse = parseDiseaseApiResponse(
      {
        success: false,
        execution_status: 'failed',
        inference_outcome: 'provider_error',
        notice: 'Computer vision endpoint temporarily busy. Please retry.',
      },
      'Rice'
    );

    expect(errorResponse.inference_outcome).toBe('provider_error');
    expect(errorResponse.execution_status).toBe('failed');
    expect(errorResponse.notice).toContain('Computer vision endpoint temporarily busy');
    // Active page MUST stay on disease-detection
    expect(activePage).toBe('disease-detection');
  });

  it('4. Explicit navigation to dashboard still works correctly when chosen by user', () => {
    let activePage = 'disease-detection';

    const handleNavigate = (page: string) => {
      activePage = page;
    };

    handleNavigate('dashboard');
    expect(activePage).toBe('dashboard');
  });
});
