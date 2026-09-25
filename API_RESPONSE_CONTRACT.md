# AgriFusion Authoritative Backend API Response Contract

**Version**: 2.1.0  
**Base URL**: `https://dl-project-agrifusion-backend.onrender.com`  
**Database**: Supabase PostgreSQL (`public` schema)  
**OpenAPI Spec**: `/openapi.json` & `/docs`

---

## 1. Overview & General Conventions

AgriFusion delegates **100% of persistent data storage** to the FastAPI backend and Supabase PostgreSQL. This document defines the exact contracts for every registered route.

### Response Conventions

1. **Paginated Collections (`/admin/*`)**:
   - Shape: `{ "items": [...], "page": 1, "page_size": 25, "total": 0 }`
   - Endpoint-specific metadata (e.g. `privacy_note`, `suppressed_groups`, `rating_distribution`) are included at the root envelope level where specified.

2. **Farmer Resource Collections (`/api/v1/farms`, `/predictions`, etc.)**:
   - Named array keys match domain resources (`farms`, `predictions`, `diagnostics`, `field_actions`, `searches`).
   - Shape: `{ "<resource_name>": [...], "total": 0 }`

3. **Single Resource Reads / Mutations**:
   - Returns the exact unwrapped model object (e.g. Farm record, Profile object, AdminSourceItem).

4. **Action / Mutation Operations**:
   - Shape: `{ "status": "success", "message": "...", ... }` or `{ "success": true, "message": "..." }`

5. **Error JSON Envelope (HTTP 4xx / 5xx)**:
   ```json
   {
     "success": false,
     "stage": "crop",
     "error_code": "INVALID_INPUT",
     "message": "District Visakhapatnam not found in state Andhra Pradesh",
     "retryable": false
   }
   ```
   *Standard HTTP Status Codes*:
   - `401 Unauthorized`: Missing or invalid Bearer JWT.
   - `403 Forbidden`: User role does not hold required permission (`require_admin`).
   - `404 Not Found`: Resource ID does not exist.
   - `422 Unprocessable Entity`: Input validation failure.
   - `500 Internal Server Error`: Database or internal engine failure (fails closed).

---

## 2. Comprehensive Endpoint Reference

### 2.1 Base & Health Endpoints

#### `GET /`
- **Auth**: None
- **Read/Write**: Read
- **Description**: Server root information and documentation link.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "title": "AgriFusion Unified REST API Server",
    "version": "2.0.0",
    "status": "online",
    "documentation": "/docs"
  }
  ```

#### `GET /health`
- **Auth**: None
- **Read/Write**: Read
- **Description**: Lightweight health check for monitoring probes.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-24T22:40:00Z",
    "supabase_connected": true
  }
  ```

#### `GET /ready`
- **Auth**: None
- **Read/Write**: Read
- **Description**: Comprehensive backend readiness summary.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "status": "ready",
    "service": "agrifusion-backend",
    "timestamp": "2026-09-24T22:40:00Z",
    "services": {
      "backend": "healthy",
      "database": "healthy",
      "rag_documents": "ready",
      "models": "ready"
    },
    "rag_documents_available": true,
    "database_configured": true,
    "external_models_configured": true
  }
  ```

---

### 2.2 Authentication & Identity (`/api/v1/auth`)

#### `POST /api/v1/auth/signup`
- **Auth**: None
- **Read/Write**: Write (`auth.users`, `public.profiles`)
- **Request Body**:
  ```json
  {
    "email": "farmer@agrifusion.com",
    "password": "Password123!",
    "full_name": "Ramesh Kumar",
    "phone": "+919876543210"
  }
  ```
- **Success Response (HTTP 201 Created)**:
  ```json
  {
    "authenticated": true,
    "user_id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
    "email": "farmer@agrifusion.com",
    "role": "farmer",
    "message": "User created successfully."
  }
  ```

#### `POST /api/v1/auth/login`
- **Auth**: None
- **Read/Write**: Read (`auth.users`, `public.profiles`)
- **Request Body**:
  ```json
  {
    "email": "farmer@agrifusion.com",
    "password": "Password123!"
  }
  ```
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "authenticated": true,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user_id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
    "email": "farmer@agrifusion.com",
    "role": "farmer"
  }
  ```

#### `POST /api/v1/auth/logout`
- **Auth**: Authenticated User
- **Read/Write**: Read
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "authenticated": false,
    "message": "User farmer@agrifusion.com logged out successfully."
  }
  ```

#### `GET /api/v1/auth/me`
- **Auth**: Authenticated User
- **Read/Write**: Read (`public.profiles`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "authenticated": true,
    "user_id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
    "email": "farmer@agrifusion.com",
    "role": "farmer",
    "status": "active"
  }
  ```

#### `GET /api/v1/auth/admin-check`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "authorized": true,
    "user_id": "a9b8c7d6-e5f4-3210-fedc-ba9876543210",
    "email": "admin@agrifusion.com",
    "role": "admin"
  }
  ```

---

### 2.3 AI Predictions, RAG & Agronomy Pipelines

#### `POST /api/v1/predict/crop`
- **Auth**: Optional User
- **Read/Write**: Write (`public.prediction_records`, `public.system_events`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "village": "Anakapalle", "sowing_date": "2026-06-15"}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "crop",
    "result": {
      "recommended_crops": [
        {"crop": "Rice", "confidence": 0.92, "reasoning": "Optimal soil and monsoon alignment"},
        {"crop": "Maize", "confidence": 0.85, "reasoning": "Suitable temperature range"}
      ],
      "top_crop": "Rice"
    }
  }
  ```

#### `POST /api/v1/predict/climate`
- **Auth**: Optional User
- **Read/Write**: Read/Write (`public.system_events`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "sowing_date": "2026-06-15"}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "climate",
    "result": {
      "crop": "Rice",
      "risk_level": "Low",
      "temperature_avg": 28.5,
      "precipitation_total_mm": 450.0
    }
  }
  ```

#### `POST /api/v1/predict/irrigation`
- **Auth**: Optional User
- **Read/Write**: Write (`public.prediction_records`, `public.system_events`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "area_ha": 2.0, "pump_hp": 5.0}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "irrigation",
    "result": {
      "total_water_liters": 120000,
      "pump_runtime_hours": 4.5,
      "irrigation_frequency": "Every 3 days"
    }
  }
  ```

#### `POST /api/v1/predict/yield`
- **Auth**: Optional User
- **Read/Write**: Write (`public.prediction_records`, `public.system_events`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "season": "Kharif", "area_ha": 2.0, "year": 2026}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "yield",
    "result": {
      "expected_yield_tons": 7.2,
      "yield_per_hectare_tons": 3.6
    }
  }
  ```

#### `POST /api/v1/predict/market`
- **Auth**: Optional User
- **Read/Write**: Write (`public.prediction_records`, `public.system_events`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "commodity": "Rice", "area_ha": 2.0, "season": "Kharif", "start_date": "2026-06-15", "end_date": "2026-10-15", "year": 2026, "market_date": "2026-10-20"}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "market",
    "result": {
      "forecasted_price_per_quintal": 2250.0,
      "price_trend": "Increasing",
      "expected_revenue": 162000.0
    }
  }
  ```

#### `POST /api/v1/predict/disease`
- **Auth**: Optional User
- **Read/Write**: Write (`public.diagnostic_reports`, `public.system_events`)
- **Request**: Multipart Form-Data (`file`: Image upload, `crop`: "Rice")
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "disease",
    "result": {
      "diagnosis": "Rice Blast (Magnaporthe oryzae)",
      "confidence": 0.94,
      "severity": "Moderate",
      "treatment_recommendations": [
        "Apply Tricyclazole 75% WP at 0.6 g/L water",
        "Maintain proper field drainage"
      ]
    }
  }
  ```

#### `POST /api/v1/schemes/recommend`
- **Auth**: Optional User
- **Read/Write**: Read (`public.government_schemes`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "crop": "Rice", "area_ha": 2.0}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "schemes",
    "result": {
      "eligible_schemes": [
        {
          "scheme_name": "PM-KISAN",
          "subsidy_amount": "₹6,000 / year",
          "official_url": "https://pmkisan.gov.in"
        }
      ],
      "match_count": 1
    }
  }
  ```

#### `POST /api/v1/pipeline/run`
- **Auth**: Optional User
- **Read/Write**: Write (`public.prediction_records`)
- **Request Body**: `{"state": "Andhra Pradesh", "district": "Visakhapatnam", "area_ha": 2.0, "sowing_date": "2026-06-15", "pump_hp": 5.0}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "stage": "pipeline",
    "result": {
      "crop_recommendation": {"top_crop": "Rice"},
      "climate_risk": {"risk_level": "Low"},
      "irrigation": {"total_water_liters": 120000},
      "yield_forecast": {"expected_yield_tons": 7.2},
      "market_forecast": {"forecasted_price_per_quintal": 2250.0},
      "recommended_schemes": [{"scheme_name": "PM-KISAN"}]
    }
  }
  ```

#### `POST /api/v1/agent/query`
- **Auth**: Optional User
- **Read/Write**: Write (`public.advisory_activity_logs`, `public.system_events`)
- **Request Body**: `{"query": "How to prevent paddy stem borer?", "crop": "Rice", "state": "Andhra Pradesh"}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "advisory_id": "adv-8f3a9b1c",
    "query": "How to prevent paddy stem borer?",
    "answer": "Apply Chlorantraniliprole 0.4% GR at 10 kg/ha during vegetative stage.",
    "sources": [
      {
        "title": "ICAR Rice Pest Management Handbook",
        "organization": "ICAR",
        "url": "https://icar.org.in",
        "verified_date": "2026-01-15"
      }
    ],
    "compliance": {
      "citations_present": true,
      "compliance_status": "verified"
    }
  }
  ```

#### `POST /api/v1/feedback`
- **Auth**: Optional User
- **Read/Write**: Write (`public.farmer_feedback`)
- **Request Body**: `{"rating": 5, "category": "incorrect_answer", "message": "Clear advice."}`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "status": "success",
    "id": "fb-9a8b7c6d",
    "message": "Feedback submitted successfully."
  }
  ```

---

### 2.4 Farmer Profile & Farm Management (`/api/v1/profile`, `/api/v1/farms`)

#### `GET /api/v1/profile` (and `/api/v1/farmer/profile`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Read (`public.profiles`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
    "email": "farmer@agrifusion.com",
    "full_name": "Ramesh Kumar",
    "phone": "+919876543210",
    "role": "farmer",
    "status": "active",
    "created_at": "2026-09-01T10:00:00Z",
    "updated_at": "2026-09-24T12:00:00Z"
  }
  ```

#### `PUT /api/v1/profile` (and `/api/v1/farmer/profile`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Write (`public.profiles`)
- **Request Body**: `{"full_name": "Ramesh Kumar", "phone": "+919876543210"}`
- **Success Response (HTTP 200 OK)**: Returns updated Profile object.

#### `GET /api/v1/farms` (and `/api/v1/farmer/farms`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Read (`public.farms`)
- **Description**: Returns farmer's own personal registered farms list.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "farms": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d4e5",
        "user_id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
        "name": "Green Valley Farm",
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "village": "Anakapalle",
        "latitude": 17.6868,
        "longitude": 83.0039,
        "land_area": 5.5,
        "land_area_unit": "acres",
        "soil_type": "Alluvial",
        "crop": "Paddy",
        "irrigation_type": "Drip",
        "created_at": "2026-09-15T08:30:00Z"
      }
    ],
    "total": 1
  }
  ```
- **Empty List Response**: `{"farms": [], "total": 0}`

#### `POST /api/v1/farms` (and `/api/v1/farmer/farms`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Write (`public.farms`)
- **Request Body**: `{"name": "Green Valley", "state": "Andhra Pradesh", "district": "Visakhapatnam", "land_area": 5.5, "land_area_unit": "acres", "crop": "Paddy", "irrigation_type": "Drip"}`
- **Success Response (HTTP 201 Created)**: Returns single Farm object.

#### `GET /api/v1/farms/{farm_id}` (and `/api/v1/farmer/farms/{farm_id}`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Read (`public.farms`)
- **Success Response (HTTP 200 OK)**: Returns single Farm object.
- **Error (HTTP 404)**: Resource does not exist or belong to caller.

#### `PUT /api/v1/farms/{farm_id}` (and `/api/v1/farmer/farms/{farm_id}`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Write (`public.farms`)
- **Success Response (HTTP 200 OK)**: Returns updated Farm object.

#### `DELETE /api/v1/farms/{farm_id}` (and `/api/v1/farmer/farms/{farm_id}`)
- **Auth**: Authenticated Farmer
- **Read/Write**: Write (`public.farms`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "message": "Farm f47ac10b-58cc-4372-a567-0e02b2c3d4e5 deleted successfully."
  }
  ```

---

### 2.5 Admin Management & Aggregations (`/api/v1/admin/*`)

#### 1. Overview Page (`GET /api/v1/admin/overview` / `/dashboard`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.profiles`, `public.system_events`, `public.farms`, `public.farmer_feedback`)
- **Query Params**: None
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "generated_at": "2026-09-25T09:20:00Z",
    "registered_users": 150,
    "active_farmers": 142,
    "farm_counts": 210,
    "prediction_volume": 1250,
    "advisory_volume": 840,
    "pending_feedback": 12,
    "failed_requests": 3,
    "review_alerts": 15,
    "service_health": {
      "backend": {"status": "healthy", "message": "OK"},
      "database": {"status": "healthy", "message": "Supabase connection verified"},
      "models": {"status": "ready", "available_count": 6, "expected_count": 6},
      "storage": {"status": "healthy", "message": "Storage bucket accessible"},
      "rag_documents": {"status": "ready", "document_count": 12}
    },
    "trends": {
      "predictions_daily": [{"date": "2026-09-25", "count": 1250}],
      "advisories_daily": [{"date": "2026-09-25", "count": 840}]
    },
    "uncollected_metrics": ["realtime_cpu_gpu_memory_per_inference"]
  }
  ```

#### 2. Users & RBAC Page (`GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{user_id}/*`)
- **`GET /api/v1/admin/users`**: List user directory with pagination & search.
  - **Auth**: Authenticated Admin (`require_admin`)
  - **Params**: `role`, `status`, `search`, `page=1`, `page_size=25`
  - **Success Response (HTTP 200 OK)**:
    ```json
    {
      "items": [
        {
          "id": "c1f7a4e2-8b9a-4c2d-9e1f-8a2b3c4d5e6f",
          "email": "farmer@agrifusion.com",
          "full_name": "Ramesh Kumar",
          "phone": "+919876543210",
          "role": "farmer",
          "status": "active",
          "created_at": "2026-09-01T10:00:00Z",
          "last_sign_in_at": "2026-09-24T18:00:00Z"
        }
      ],
      "page": 1,
      "page_size": 25,
      "total": 1
    }
    ```
- **`PATCH /api/v1/admin/users/{user_id}/status`**: Update user status (`active`, `suspended`, `archived`). Audits `user_status_changed`.
- **`PATCH /api/v1/admin/users/{user_id}/role`**: Update user role (`super_admin`, `admin`, `auditor`, `agronomist`, `editor`, `farmer`). Checks last admin protection, audits `user_role_changed`.

#### 3. Farms & Coverage Page (`GET /api/v1/admin/farms`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.farms`)
- **Params**: `state`, `district`, `crop`, `area_range`, `irrigation_type`, `privacy_threshold=5` (default 5, min 1, max 50)
- **Privacy & Response Rules**: Count-oriented aggregate response ONLY. Individual farm rows, grouped profile lists, and PII fields (`id`, `user_id`, `name`, `village`, `latitude`, `longitude`) are strictly excluded.
- **Cohort Threshold Handling**:
  - `count >= privacy_threshold`: returns exact matching count (e.g. `count: 12`, `suppressed: false`).
  - `1 <= count < privacy_threshold`: returns matching total with suppression flag active (e.g. `count: 3`, `suppressed: true`, and `privacy_note: "Fewer than 5 farms match the selected filters."`).
  - `count == 0`: returns `count: 0`, `suppressed: false`, `privacy_note: "No farms match the selected filters."`.
  - Database Query Failure: Raises HTTP 500 error; never returns 0 or null on query error.
- **Success Response (HTTP 200 OK - Matching Filtered Count)**:
  ```json
  {
    "count": 12,
    "filters_applied": {
      "state": "Andhra Pradesh",
      "district": "Visakhapatnam",
      "crop": "Paddy",
      "area_range": null,
      "irrigation_type": null
    },
    "suppressed": false,
    "privacy_threshold": 5,
    "privacy_note": "Count of farms matching the selected filters."
  }
  ```
- **Success Response (HTTP 200 OK - Suppressed Small Cohort)**:
  ```json
  {
    "count": 3,
    "filters_applied": {
      "state": "Andhra Pradesh",
      "district": "Visakhapatnam",
      "crop": "Papaya",
      "area_range": null,
      "irrigation_type": null
    },
    "suppressed": true,
    "privacy_threshold": 5,
    "privacy_note": "Fewer than 5 farms match the selected filters."
  }
  ```

#### 4. Predictions Analytics Page (`GET /api/v1/admin/predictions`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Params**: `prediction_type`, `state`, `district`, `crop`, `status`, `start_date`, `end_date`, `page=1`, `page_size=25`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [
      {
        "id": "pred-101",
        "prediction_type": "crop_recommendation",
        "status": "completed",
        "latency_ms": 142.5,
        "request_payload": {"state": "Andhra Pradesh", "district": "Visakhapatnam"},
        "result_payload": {"top_crop": "Rice"},
        "created_at": "2026-09-25T08:30:00Z"
      }
    ],
    "page": 1,
    "page_size": 25,
    "total": 1,
    "analytics": {
      "total_predictions": 1,
      "success_count": 1,
      "error_count": 0,
      "average_latency_ms": 142.5,
      "by_type": {
        "crop_recommendation": 1,
        "climate_risk": 0,
        "irrigation_schedule": 0,
        "yield_forecast": 0,
        "market_price": 0,
        "disease_detection": 0,
        "pipeline": 0
      },
      "trends": [{"date": "2026-09-25", "count": 1}]
    },
    "uncollected_metrics_note": "Hardware CPU/RAM consumption per model execution is uncollected; API response latencies and prediction outcome tallies are tracked from persisted system event ledgers."
  }
  ```

#### 5. Advisory Activity & Quality Page (`GET /api/v1/admin/advisories`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Params**: `crop`, `state`, `district`, `status`, `review_status`, `start_date`, `end_date`, `search`, `page=1`, `page_size=25`
- **Error Handling**: Database read failures return **HTTP 500 Internal Server Error** instead of returning HTTP 200 OK with `items: []`.
- **Empty State**: Genuine empty table returns **HTTP 200 OK** with `items: []`, `total: 0`, and `privacy_note: "No advisory activity recorded yet."`.
- **Activity Statuses**: `success`, `no_verified_source`, `timeout`, `failed`.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [
      {
        "query_id": "adv-8f3a9b1c",
        "created_at": "2026-09-25T07:15:00Z",
        "crop": "Paddy",
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "query_summary": "Paddy Pest Control Request",
        "activity_status": "success",
        "review_status": "not_reviewed",
        "retrieval": {
          "documents_considered": 3,
          "documents_used": 1,
          "relevance_threshold_passed": true,
          "no_verified_source": false
        },
        "sources": [
          {
            "title": "ICAR Rice Pest Handbook",
            "organization": "ICAR",
            "url": "https://icar.org.in",
            "verified_date": "2026-01-15"
          }
        ],
        "compliance": {
          "citations_present": true,
          "compliance_status": "passed"
        }
      }
    ],
    "page": 1,
    "page_size": 25,
    "total": 1,
    "privacy_note": "Advisory activity is anonymized and shown for quality monitoring."
  }
  ```
- **Mutations**:
  - `PATCH /api/v1/admin/advisories/{query_id}/review`: Updates review status (`needs_review`, `reviewed`, `resolved`).
  - `POST /api/v1/admin/advisories/{query_id}/note`: Attaches administrative note.

#### 6. Knowledge Sources Page (`GET /api/v1/admin/sources`, `POST /sources/upload-document`)
- **`GET /api/v1/admin/sources`**: Searchable source registry with verification and indexing metadata.
- **`POST /api/v1/admin/sources/register`**: Register new official publication or URL.
- **`POST /api/v1/admin/sources/upload-document`**: Multipart document upload (PDF, DOCX, TXT, MD, <= 15MB). Saves to `Data/agronomy_docs/`, registers in DB registry, forces RAG document reload, and logs audit event.
- **`PATCH /api/v1/admin/sources/{source_id}`**: Update verification status (`pending_review`, `verified`, `verified_with_caveats`, `needs_review`, `stale`, `unavailable`, `rejected`), caveats, and active flag.
- **`POST /api/v1/admin/sources/{source_id}/reindex`**: Queue single source reindexing.
- **`POST /api/v1/admin/knowledge-sources/sync`**: Trigger bulk RAG document re-indexing.

#### 7. Government Schemes Page (`GET /api/v1/admin/schemes`)
- **`GET /api/v1/admin/schemes`**: Paginated schemes catalog. Filters: `state`, `district`, `department`, `scheme_type`, `verification_status`, `current_status`, `search`.
- **`POST /api/v1/admin/schemes/register`**: Register new central/state scheme.
- **`POST /api/v1/admin/schemes/{scheme_id}/verify`**: Officially verify scheme using portal source URL and notes.
- **`POST /api/v1/admin/schemes/{scheme_id}/recheck`**: Request scheme re-verification review.
- **`PATCH /api/v1/admin/schemes/{scheme_id}`**: Update scheme verification/current status.
- **`DELETE /api/v1/admin/schemes/{scheme_id}`**: Remove scheme record.

#### 8. Feedback & Review Queue Page (`GET /api/v1/admin/feedback`)
- **`GET /api/v1/admin/feedback`**: Paginated farmer feedback list with rating distribution. Filters: `status`, `category`, `priority`, `rating`, `assigned_to`, `start_date`, `end_date`, `search`.
- **`GET /api/v1/admin/feedback/{feedback_id}`**: Detail view with note history and compliance checks.
- **`PATCH /api/v1/admin/feedback/{feedback_id}`**: Update status, priority, or `assigned_to` reviewer.
- **`POST /api/v1/admin/feedback/{feedback_id}/note`**: Attach review note.

#### 9. Diagnostics & Reports Page (`GET /api/v1/admin/diagnostics`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Params**: `crop`, `state`, `district`, `status`, `severity`, `start_date`, `end_date`, `page=1`, `page_size=25`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [
      {
        "id": "diag-101",
        "created_at": "2026-09-25T06:00:00Z",
        "crop": "Rice",
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "diagnosis": "Rice Blast",
        "confidence": 0.94,
        "severity": "Moderate",
        "treatment_recommendations": ["Apply Tricyclazole 75% WP"],
        "status": "reviewed",
        "identity_redacted": true
      }
    ],
    "page": 1,
    "page_size": 25,
    "total": 1,
    "privacy_note": "Diagnostic records are presented with farmer identity minimized."
  }
  ```

#### 10. System Health Page (`GET /api/v1/admin/system-health`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "overall_status": "healthy",
    "checked_at": "2026-09-25T09:20:00Z",
    "services": {
      "api": {"status": "healthy", "latency_ms": 1.2, "last_check": "2026-09-25T09:20:00Z", "error_summary": null},
      "database": {"status": "healthy", "latency_ms": 2.5, "last_check": "2026-09-25T09:20:00Z", "error_summary": null},
      "models": {"status": "ready", "latency_ms": 3.1, "last_check": "2026-09-25T09:20:00Z", "available_count": 6, "expected_count": 6, "models": {"crop_recommendation": "ready", "climate_risk": "ready", "irrigation": "ready", "yield": "ready", "market_price": "ready", "object_detection": "ready"}, "error_summary": null},
      "storage": {"status": "healthy", "latency_ms": 1.8, "last_check": "2026-09-25T09:20:00Z", "bucket_name": "crop-images", "error_summary": null},
      "rag": {"status": "ready", "latency_ms": 2.0, "last_check": "2026-09-25T09:20:00Z", "document_count": 12, "error_summary": null}
    }
  }
  ```

#### 11. Audit Logs Page (`GET /api/v1/admin/audit-logs`, `GET /export`)
- **`GET /api/v1/admin/audit-logs`**: Paginated audit log trail. Filters: `admin_user_id`, `action`, `target_type`, `start_date`, `end_date`, `page=1`, `page_size=25`.
- **`GET /api/v1/admin/audit-logs/export`**: Download CSV export. Excludes passwords, tokens, and secrets.

#### 12. Settings & Permissions Page (`GET /api/v1/admin/settings`, `PATCH /settings`)
- **`GET /api/v1/admin/settings`**: Retrieves current system configuration, role permissions matrix, alert thresholds, and integration statuses.
- **`PATCH /api/v1/admin/settings`**: Updates configurable settings (`cohort_privacy_threshold`, `log_retention_days`, `alert_error_rate_percent`, `alert_latency_p95_ms`, `pii_redaction_enabled`, `maintenance_mode`). Restricted to `super_admin` or `admin`. Records audit log `system_settings_updated`.

---

## 3. Frontend Mismatches & Implementation Guidance

1. **`GET /api/v1/admin/farms` vs `GET /api/v1/farms`**:
   - `GET /api/v1/farms` returns a farmer's own farm list (`{"farms": [...], "total": N}`). Frontend reads `data.farms`.
   - `GET /api/v1/admin/farms` returns privacy-preserving count and filter summary (`{"count": N, "filters_applied": {...}, "suppressed": bool, "privacy_threshold": 5, "privacy_note": "..."}`). Frontend displays the aggregate `count`, active filters, and `privacy_note`. If `suppressed` is true, display the privacy indicator.

2. **Error Responses**:
   - All errors use standard status codes (`401`, `403`, `404`, `422`, `500`) and standard JSON payload `{ "success": false, "stage": "...", "error_code": "...", "message": "..." }`. Frontend code should inspect `res.status` and `data.message`.

