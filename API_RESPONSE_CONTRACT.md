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

#### `GET /api/v1/admin/dashboard` (alias `/api/v1/admin/overview`)
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.profiles`, `public.system_events`, `public.farmer_feedback`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "total_users": 1,
    "active_farmers": 1,
    "advisory_queries": 0,
    "prediction_requests": 0,
    "failed_requests": 0,
    "feedback_awaiting_review": 0,
    "services": {
      "backend": "healthy",
      "database": "healthy",
      "rag_documents": "ready",
      "models": "ready"
    }
  }
  ```

#### `GET /api/v1/admin/users`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`auth.users`, `public.profiles`)
- **Params**: `role`, `status`, `search`, `page=1`, `limit=50`
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
        "last_sign_in_at": "2026-09-24T18:00:00Z",
        "farms_count": 1
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
  ```

#### `GET /api/v1/admin/farms`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.farms`)
- **Params**: `state`, `district`, `crop`, `irrigation_type`, `min_group_threshold=5` (default 5, min 1), `page=1`, `page_size=25`
- **Privacy Rules**: Aggregate cohort grouping ONLY. Identifying fields (`id`, `user_id`, `name`, `village`, `latitude`, `longitude`) are strictly excluded.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [
      {
        "state": "Andhra Pradesh",
        "district": "Visakhapatnam",
        "crop": "Paddy",
        "area_range": "5–10 acres",
        "irrigation_type": "Drip"
      }
    ],
    "page": 1,
    "page_size": 25,
    "total": 1,
    "suppressed_groups": 0,
    "privacy_note": "Only minimized regional farm information is shown."
  }
  ```
- **Empty / Suppressed Groups Response**:
  ```json
  {
    "items": [],
    "page": 1,
    "page_size": 25,
    "total": 0,
    "suppressed_groups": 1,
    "privacy_note": "All 1 regional farm group(s) were suppressed because they had fewer than 5 record(s)."
  }
  ```

#### `GET /api/v1/admin/feedback`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.farmer_feedback`)
- **Params**: `status`, `category`, `priority`, `page=1`, `page_size=25`
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [],
    "page": 1,
    "page_size": 25,
    "total": 0,
    "rating_distribution": {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0
    }
  }
  ```

#### `GET /api/v1/admin/knowledge-sources`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.knowledge_sources`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [],
    "page": 1,
    "page_size": 25,
    "total": 0,
    "privacy_note": "Knowledge sources listing."
  }
  ```

#### `POST /api/v1/admin/knowledge-sources/sync`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Write (`public.admin_audit_logs`)
- **Description**: Triggers idempotent re-indexing of agronomy knowledge documents.
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Agronomy knowledge documents re-indexed successfully.",
    "documents_indexed": 12
  }
  ```

#### `GET /api/v1/admin/schemes`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.government_schemes`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [],
    "page": 1,
    "page_size": 25,
    "total": 0,
    "privacy_note": "Government schemes catalog."
  }
  ```

#### `GET /api/v1/admin/activity`
- **Auth**: Authenticated Admin (`require_admin`)
- **Read/Write**: Read (`public.admin_audit_logs`)
- **Success Response (HTTP 200 OK)**:
  ```json
  {
    "items": [],
    "page": 1,
    "page_size": 25,
    "total": 0
  }
  ```

---

## 3. Frontend Mismatches & Implementation Guidance

1. **`GET /api/v1/admin/farms` vs `GET /api/v1/farms`**:
   - `GET /api/v1/farms` returns a farmer's own farm list (`{"farms": [...], "total": N}`). Frontend reads `data.farms`.
   - `GET /api/v1/admin/farms` returns privacy-preserving cohort groups (`{"items": [...], "page": 1, "page_size": 25, "total": N, "suppressed_groups": S, "privacy_note": "..."}`). Frontend must read `items` and display `privacy_note`. Never attempt to display `user_id` or farm coordinates from the admin endpoint.

2. **Error Responses**:
   - All errors use standard status codes (`401`, `403`, `404`, `422`, `500`) and standard JSON payload `{ "success": false, "stage": "...", "error_code": "...", "message": "..." }`. Frontend code should inspect `res.status` and `data.message`.
