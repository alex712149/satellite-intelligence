# Sentinel Watch

acc to the code zip file i have given make this --- # SENTINEL INTELLIGENCE — ULTIMATE MASTER FRONTEND PROMPT

Build a production-quality frontend called:

SENTINEL INTELLIGENCE

This is the frontend of a Smart India Hackathon 2026 project:

"Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery"

This is a real working system, not a UI mockup.

The final product will operate entirely on REAL locally stored satellite imagery and a REAL local Python/FastAPI backend.

There must be NO simulated analytical data, NO fake satellite imagery, NO mock API, and NO cloud AI dependency.

============================================================
1. CORE SYSTEM ARCHITECTURE
============================================================

The actual system is:

LOCAL SATELLITE DATA
        ↓
Geospatial preprocessing
        ↓
Spatial tiling
        ↓
                TILE
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼                     ▼
 RGB representation    Multispectral bands
       │                     │
       ▼                     ▼
 RemoteCLIP/OpenCLIP    NDVI / NDWI /
       │                quality features
       ▼                     │
 semantic embedding         │
       │                     │
       └──────────┬──────────┘
                  ▼
             Tile record
                  │
          ┌───────┴────────┐
          ▼                ▼
        FAISS          SQLite/catalog
          │                │
          ▼                ▼
 semantic/image       metadata,
 retrieval             provenance,
                        analytics
          │                │
          └───────┬────────┘
                  ▼
            CHANGE ENGINE
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
  semantic     spectral    quality
    delta        delta      score
       └──────────┼──────────┘
                  ▼
             confidence
                  ▼
          candidate change type
                  ▼
            analyst review
           /             \
      confirm            reject
           \             /
              audit trail

The frontend must ONLY visualize and interact with the outputs of this real backend.

The frontend must NOT implement:
- satellite preprocessing
- RemoteCLIP/OpenCLIP
- embedding generation
- FAISS
- NDVI
- NDWI
- change detection
- change classification
- clustering
- SQLite/database logic

All of those belong to the Python backend.

============================================================
2. DATA SOURCE AND RUNTIME
============================================================

The satellite imagery has ALREADY been downloaded from Copernicus Data Space / Copernicus Browser and is stored LOCALLY.

Copernicus is the source/provenance of the raw imagery, NOT a runtime dependency.

At runtime the application must NOT contact:

- Copernicus
- Copernicus APIs
- cloud imagery services
- external map providers
- external AI services
- external inference APIs

The final application must continue working when the machine has NO INTERNET ACCESS.

Runtime flow:

LOCAL SENTINEL-2 DATA
        ↓
LOCAL PYTHON BACKEND
        ↓
LOCAL ML MODELS
        ↓
LOCAL FAISS
        ↓
LOCAL SQLite
        ↓
LOCAL FASTAPI
        ↓
LOCAL REACT FRONTEND

Document the data source as:

"Sentinel-2 imagery downloaded from Copernicus Data Space and staged locally for offline processing and analysis."

============================================================
3. FRONTEND TECHNOLOGY
============================================================

This is a local React/Vite project.

Use:

React
Vite
TypeScript

Do NOT use TanStack Start.

Use the normal Vite React structure:

src/
├── components/
├── pages/
├── routes/
├── lib/
├── hooks/
├── stores/
├── assets/
└── styles/

A future FastAPI backend will live in a sibling:

backend/

Do NOT create the backend inside the frontend.

Do NOT create a top-level frontend/ directory.

============================================================
4. REAL BACKEND — NO MOCK API
============================================================

IMPORTANT:

There is NO mock API.

Do NOT create:
- seeded mock data
- random fake results
- simulated satellite imagery
- fake coordinates
- fake similarity scores
- fake NDVI values
- fake change candidates

The frontend must connect to the REAL FastAPI backend.

Create one centralized API client:

src/lib/api.ts

This is the ONLY place where frontend HTTP communication with FastAPI occurs.

Every component must consume typed functions from this module.

Do NOT place fetch() calls directly inside React components.

The future real backend will expose these endpoints:

GET /aois

GET /aois/{aoi_id}/timeline

GET /aois/{aoi_id}/mosaic?date=YYYY-MM

POST /aois/onboard

GET /aois/onboard/{job_id}

GET /tiles/{vector_id}

GET /tiles/{vector_id}/similar

POST /search/text

POST /search/image

GET /change/candidates

GET /change/candidates/{candidate_id}

POST /review/{candidate_id}/decision

GET /review/audit-log

GET /clusters

GET /stats

Use the exact response shapes supplied in the API specification.

Do NOT invent alternative field names.

============================================================
5. REAL DATA ONLY
============================================================

Every analytical value displayed in the UI must originate from the backend.

That includes:

- satellite image
- mosaic
- tile thumbnail
- tile ID
- vector ID
- AOI
- coordinates
- acquisition date
- similarity
- NDVI
- NDWI
- cloud fraction
- cluster ID
- embedding drift
- spectral delta
- combined score
- confidence
- change type
- suppression reason
- analyst status
- provenance

Do not generate any of these values in React.

If data is unavailable, show:

- loading
- empty
- unavailable
- backend error

Do NOT replace missing real data with fake data.

============================================================
6. AOIs
============================================================

Initial real AOIs:

1. Dholera SIR, Gujarat
2. Noida International Airport / Jewar, Uttar Pradesh
3. Navi Mumbai International Airport, Maharashtra

Dholera is the primary demonstration area.

The frontend must not assume a fixed number of scenes or dates.

The timeline must use exactly the dates returned by the backend.

Do NOT hardcode "72 months".

Do NOT hardcode "84 months".

============================================================
7. OFFLINE REQUIREMENT
============================================================

The complete interface must be able to operate without internet access.

Do NOT use:

- Google Maps
- Mapbox
- OpenStreetMap
- external basemap tiles
- online geocoding
- external satellite tiles
- external CDN imagery
- external AI APIs
- external fonts
- icon CDNs

All fonts and icons must be bundled locally.

Use local npm packages such as:

@fontsource/*
lucide-react

or equivalent locally bundled resources.

Never insert a Google Fonts <link>.

============================================================
8. CUSTOM AOI VIEWER
============================================================

The AOI viewer must NOT use Leaflet, Mapbox or any external map provider.

Build a self-contained custom image viewer.

Base layer:

real satellite mosaic returned by FastAPI.

Overlay:

- tile boundaries
- selected tile
- cluster information
- change markers
- candidate markers
- labels where useful

Support:

- pan
- drag
- wheel zoom
- zoom around cursor
- zoom in
- zoom out
- reset
- fit to view
- select tile
- smooth date transition

Use Canvas and/or optimized DOM transforms.

Do not convert the viewer into a conventional online map.

============================================================
9. MISSION CONTROL
============================================================

Route:

/

Purpose:

high-level operational overview.

Read all statistics from:

GET /stats

Display:

- AOIs
- scenes ingested
- total tiles indexed
- FAISS vector count
- change candidates scored
- promoted candidates
- confirmed candidates

Also expose suppressed candidates if provided by backend.

Do NOT calculate statistics in the browser.

Show three AOI cards.

Each card displays:

- AOI name
- location
- date range
- scenes
- indexed tiles
- preview mosaic
- latest activity
- navigation to Explorer

Include:

- recent change activity
- review queue summary
- system status
- quick navigation

============================================================
10. AOI EXPLORER
============================================================

Route:

/explorer

This is a core screen.

Controls:

- AOI selector
- date selector
- zoom controls
- fit/reset controls

Main area:

custom satellite image viewer.

Timeline:

GET /aois/{aoi_id}/timeline

Render exactly the dates returned by the backend.

Features:

- drag timeline
- previous date
- next date
- current-date indicator
- crossfade between real backend mosaics

Mosaic source:

GET /aois/{aoi_id}/mosaic?date=YYYY-MM

Use:

image_url

bbox

width_px

height_px

tiles

Each tile may expose:

- tile_id
- vector_id
- row
- col
- bbox_px
- ndvi_mean
- cluster_id

Clicking a tile opens a detail panel.

Panel:

- tile ID
- vector ID
- AOI
- acquisition date
- coordinates
- NDVI
- NDWI
- cloud fraction
- cluster ID
- find similar
- view change history

============================================================
11. SEMANTIC SEARCH
============================================================

Route:

/search

This is powered entirely by the real backend.

User enters a natural-language query.

Examples:

"newly built structures near a river"

"large vehicle concentrations on open ground"

"recent construction near roads"

"vegetation clearance near water"

Frontend sends:

POST /search/text

Request:

{
  query,
  aoi_id?,
  date_from?,
  date_to?,
  top_k
}

Display backend results:

- thumbnail
- tile ID
- AOI
- acquisition date
- similarity
- coordinates

Filters:

- AOI
- date range
- top-k

Do NOT perform semantic matching in React.

The backend is responsible for the real model and FAISS retrieval.

============================================================
12. IMAGE SEARCH
============================================================

Provide image upload.

Send:

POST /search/image

using multipart/form-data.

The backend performs the real image embedding and FAISS search.

Show:

- uploaded image
- ranked results
- similarity
- AOI
- date
- tile ID

Do not calculate image similarity in the browser.

============================================================
13. CHANGE ANALYSIS
============================================================

Route:

/change/$vectorId

Use real backend data.

Display:

selected tile
date before
date after
before image
after image

Provide a draggable before/after comparison slider.

Display:

- embedding drift
- spectral delta
- combined score
- change type
- change type confidence
- earliest supported observation if supplied
- quality/confound information if supplied

NDVI chart must use:

the actual NDVI trend returned by:

GET /change/candidates/{candidate_id}

The frontend must NOT calculate the trend.

============================================================
14. CHANGE LANGUAGE
============================================================

Change classification is a candidate interpretation.

Use terminology like:

"Likely construction"

"Candidate change"

"Confidence: 87%"

Never say:

"AI proved construction occurred."

Never present zero-shot classification as absolute truth.

============================================================
15. FALSE-ALARM / SUPPRESSION UI
============================================================

False-alarm suppression is a major system capability.

The frontend must make it visible.

If the backend exposes suppressed candidates, provide:

OPEN
CONFIRMED
REJECTED
SUPPRESSED

Suppressed candidates should be read-only.

Show:

Status: SUPPRESSED

Reason:

- high cloud fraction
- insufficient valid pixels
- seasonal variation
- below threshold
- other backend-provided reason

Do NOT describe suppression as system failure.

It means the change engine deliberately filtered a low-confidence or confounded candidate.

If the backend returns a suppression count in /stats, display it on Mission Control.

============================================================
16. DISCOVERY / CLUSTERS
============================================================

Route:

/clusters

Use real backend data:

GET /clusters

Display:

- cluster ID
- member count
- representative image
- AOIs represented

Clicking a cluster displays real members from backend data.

Selecting a tile allows:

- tile detail
- similar-site discovery
- change history

Do not perform clustering in the frontend.

============================================================
17. REVIEW QUEUE
============================================================

Route:

/review

Display real change candidates.

GET /change/candidates

Show:

- candidate ID
- tile ID
- AOI
- before image
- after image
- before date
- after date
- change type
- change confidence
- combined score
- status

Actions:

CONFIRM
REJECT

Reject allows optional reason.

Send:

POST /review/{candidate_id}/decision

After action:

- update status
- update UI
- refresh data
- show feedback

============================================================
18. AUDIT LOG
============================================================

Display:

GET /review/audit-log

Show:

- log ID
- candidate
- decision
- reason
- timestamp

The UI should make the review process auditable.

============================================================
19. ADMIN / AOI ONBOARDING
============================================================

Route:

/admin/onboard

This is an operational interface.

Form:

AOI name
Local source folder path

Button:

START ONBOARDING

Send:

POST /aois/onboard

Receive:

job_id

Then poll:

GET /aois/onboard/{job_id}

Display:

queued
running
progress
done
failed

Final result displays:

- AOI
- scenes found
- scenes ingested
- scenes failed
- tiles added
- validation warnings
- per-scene outcomes

Example backend warnings may include:

"Inconsistent pixel dimensions across scenes"

"Months with no usable scene"

"Scene failed validation"

Do not fabricate progress.

============================================================
20. PROVENANCE
============================================================

The analyst must be able to see where evidence came from.

Where backend data provides it, display:

- source scene
- acquisition date
- sensor
- tile ID
- vector ID
- geographic coordinates
- processing information
- quality indicators

Remember:

the raw imagery originated from Copernicus Data Space,
but the application operates entirely on local data.

============================================================
21. ANALYST-FIRST INTERFACE
============================================================

For every change candidate the analyst should be able to answer:

WHERE?
WHEN?
WHAT?
HOW STRONG?
HOW CONFIDENT?
WHAT WAS BEFORE?
WHAT IS AFTER?
WHY WAS IT FLAGGED?
WHY WAS SOMETHING SUPPRESSED?
WHAT IS THE SOURCE?
CAN I CONFIRM OR REJECT IT?

The UI should prioritize analytical clarity.

============================================================
22. DESIGN LANGUAGE
============================================================

Visual style:

premium
dark
cinematic
technical
professional
space-intelligence
mission-control

Avoid:

- generic admin dashboard
- generic SaaS template
- crypto styling
- excessive cyberpunk
- gaming HUD appearance

Use:

- near-black background
- cyan telemetry accent
- amber warning
- red change alert
- green confirmation
- technical monospace for coordinates/telemetry
- geometric sans for headings
- precise grid lines
- subtle corner framing
- restrained glass/panel hierarchy

============================================================
23. MOTION
============================================================

Use purposeful motion.

Examples:

- subtle counter animation
- panel transitions
- timeline image crossfade
- scan-line loading
- active state glow
- smooth slider
- hover transitions

Avoid excessive animation.

Use transform and opacity wherever possible.

Respect:

prefers-reduced-motion

============================================================
24. LOADING / ERROR / EMPTY STATES
============================================================

Every real backend request must have:

loading
success
empty
error

Use meaningful status messaging such as:

"Loading archive observation"

"Resolving tile record"

"Analyzing candidate set"

"Loading temporal sequence"

Do NOT create fake results while loading.

============================================================
25. PERFORMANCE
============================================================

Design for potentially thousands of tile results.

Use:

- lazy image loading
- virtualization for large lists
- memoization where useful
- stable keys
- efficient canvas transforms
- minimal rerenders
- query caching
- request cancellation where appropriate
- debounced search input where appropriate

The interface must remain responsive.

============================================================
26. STATE MANAGEMENT
============================================================

Use TanStack Query or an equivalent robust server-state library.

Backend state should be clearly separated from UI state.

Server state includes:

- AOIs
- timelines
- mosaics
- tiles
- search results
- candidates
- clusters
- audit logs
- stats
- onboarding jobs

UI state includes:

- selected AOI
- selected tile
- viewer zoom
- viewer pan
- filters
- current tab
- selected dates

============================================================
27. TYPE SAFETY
============================================================

Use TypeScript interfaces/types for every API response.

Create types for:

AOI
Timeline
Mosaic
Tile
SearchResult
ChangeCandidate
ChangeDetail
AuditLog
Cluster
Stats
OnboardingJob

Avoid `any`.

============================================================
28. ROUTES
============================================================

Create:

/
 
/explorer

/search

/change/$vectorId

/clusters

/review

/admin/onboard

============================================================
29. ICONS / FONTS / ASSETS
============================================================

Everything must work offline.

Use locally bundled npm packages.

Good choices:

lucide-react
@fontsource/*

No:

Google Fonts links
Font Awesome CDN
icon CDN
external image CDN

============================================================
30. REAL IMAGE URL HANDLING
============================================================

The frontend receives image URLs from FastAPI.

Examples:

mosaic_thumbnail_url
image_url
thumbnail_url

Treat these as opaque URLs.

Do NOT assume the images are generated locally by React.

The backend will eventually serve:

real rendered Sentinel-2 mosaics
real tile thumbnails
real before/after imagery

The frontend should require no architectural change when these become real.

============================================================
31. NO LOCAL SATELLITE DATA PROCESSING IN REACT
============================================================

Do not read GeoTIFFs directly in React.

Do not calculate NDVI in JavaScript.

Do not calculate raster statistics in JavaScript.

Do not calculate similarity in JavaScript.

Do not run ML models in the browser.

Do not access the SQLite database from the browser.

The backend handles all data/ML processing.

React displays the resulting products.

============================================================
32. NO LLM
============================================================

Do NOT add:

- chatbot
- AI assistant
- LLM
- OpenAI integration
- Gemini integration
- Claude API integration
- natural-language explanation model

Semantic natural-language search is handled by the backend's CLIP-family embedding system.

============================================================
33. NO FAKE "AI" FEATURES
============================================================

Do not add decorative fake AI panels.

Do not display fabricated:

- confidence
- AI score
- predictions
- detections
- satellite findings

Only display values returned by the backend.

============================================================
34. DEVELOPMENT PHASES
============================================================

Build the frontend in this order:

PHASE 1
Vite + React + TypeScript project setup
Design tokens
Global styles
Navigation
Application shell

PHASE 2
API types
Real FastAPI client in src/lib/api.ts
Environment configuration for backend base URL

PHASE 3
Mission Control

PHASE 4
AOI Explorer

PHASE 5
Custom offline image viewer

PHASE 6
Semantic text search

PHASE 7
Image search

PHASE 8
Change timeline / before-after

PHASE 9
Clusters / discovery

PHASE 10
Review queue

PHASE 11
Audit log

PHASE 12
AOI onboarding

PHASE 13
Loading/error/empty states

PHASE 14
Performance optimization

PHASE 15
Accessibility

PHASE 16
Final visual polish

============================================================
35. BACKEND CONNECTION CONFIGURATION
============================================================

Use an environment variable such as:

VITE_API_BASE_URL

Example:

VITE_API_BASE_URL=http://localhost:8000

Do not hardcode the backend host throughout the application.

The production/offline machine will run the FastAPI service locally.

============================================================
36. FRONTEND / BACKEND RESPONSIBILITY
============================================================

FRONTEND:

- presentation
- interaction
- navigation
- filtering controls
- timeline controls
- image comparison
- map-like custom viewer
- API requests
- review actions
- provenance display

BACKEND:

- local satellite data
- GeoTIFF/COG processing
- tiling
- MGRS/spatial indexing
- RGB generation
- NDVI/NDWI
- quality masks
- RemoteCLIP/OpenCLIP
- embeddings
- FAISS
- semantic search
- image search
- temporal change detection
- confidence
- classification
- clustering
- SQLite
- provenance
- review persistence
- incremental ingestion

============================================================
37. FINAL USER EXPERIENCE
============================================================

The final analyst workflow should be:

OPEN SENTINEL INTELLIGENCE
        ↓
SEE SYSTEM / AOI STATUS
        ↓
SELECT AOI
        ↓
EXPLORE REAL SATELLITE OBSERVATIONS
        ↓
MOVE THROUGH REAL DATES
        ↓
INSPECT TILES
        ↓
SEARCH BY NATURAL LANGUAGE
        ↓
SEARCH BY IMAGE
        ↓
FIND SIMILAR LOCATIONS
        ↓
OPEN CHANGE ANALYSIS
        ↓
COMPARE BEFORE / AFTER
        ↓
INSPECT REAL CHANGE EVIDENCE
        ↓
CHECK CONFIDENCE + QUALITY
        ↓
CHECK WHY SOMETHING WAS SUPPRESSED
        ↓
CONFIRM / REJECT
        ↓
AUDIT TRAIL

============================================================
38. ABSOLUTE RULES
============================================================

DO NOT:

- create mock API
- create fake data
- create seeded demo analytics
- generate satellite imagery
- use AI-generated satellite imagery
- use external map services
- use external AI APIs
- use an LLM
- implement ML in React
- implement FAISS in React
- implement raster processing in React
- hardcode analytical results
- fabricate coordinates
- fabricate change detections
- fabricate confidence
- fabricate similarity
- fabricate NDVI/NDWI
- use external fonts
- use external icon CDNs
- require internet at runtime

DO:

- use REAL backend data
- use REAL locally stored satellite imagery
- keep frontend/backend cleanly separated
- use the exact API contract
- use TypeScript
- make every screen functional
- make errors and missing data explicit
- preserve provenance
- make the interface suitable for an analyst
- keep the application offline-capable
- keep the code maintainable and production-oriented

============================================================
39. FINAL PRODUCT STANDARD
============================================================

This should look and behave like a serious satellite analyst workstation.

It must NOT feel like a frontend simulation.

The real system is:

LOCAL SENTINEL-2 DATA
        ↓
REAL PYTHON PROCESSING
        ↓
REAL REMOTECLIP/OPENCLIP
        ↓
REAL EMBEDDINGS
        ↓
REAL FAISS
        ↓
REAL CHANGE ENGINE
        ↓
REAL SQLITE
        ↓
REAL FASTAPI
        ↓
REAL REACT UI

Build the frontend so that every visible result ultimately comes from that real pipeline.FINAL EXECUTION PATCH

A. FRONTEND-FIRST DEVELOPMENT WITH REAL-BACKEND SWITCH

The production system uses REAL locally processed satellite data and a REAL FastAPI backend.

However, the FastAPI backend is being developed separately after the frontend.

Therefore implement the API layer using a single abstraction:

src/lib/api.ts

Use environment configuration:

VITE_USE_FIXTURES=true|false

VITE_API_BASE_URL=http://localhost:8000

Behavior:

VITE_USE_FIXTURES=true

    ↓

use small deterministic frontend fixtures

    ↓

allows Lovable preview and frontend development

VITE_USE_FIXTURES=false

    ↓

use real fetch() requests

    ↓

FastAPI backend

IMPORTANT:

Fixtures are ONLY development scaffolding.

They must NEVER be presented as real satellite analysis.

They must NOT replace the real backend in the final system.

Do NOT create fake ML algorithms.

Do NOT generate fake satellite imagery.

Do NOT fabricate analytical conclusions.

The fixture data should exist only so the UI can be developed and visually tested before FastAPI is connected.

Keep fixtures isolated under:

src/lib/fixtures/

When the real backend is connected, changing:

VITE_USE_FIXTURES=false

must switch the application to FastAPI without modifying UI components.

B. ROUTING

This is a Vite + React application using react-router-dom.

Use React Router syntax.

Routes:

/

 

/explorer

/search

/change/:vectorId

/clusters

/review

/admin/onboard

DO NOT use TanStack Router syntax such as:

/change/$vectorId

C. SUPPRESSION REASONS

Treat backend suppression_reason as free-form diagnostic text.

Example:

"cloud_fraction_too_high_after=0.40"

Do NOT create a hardcoded suppression enum.

Display the backend reason as human-readable diagnostic information.

You may lightly format the string for presentation, but preserve the original backend value and never assume a fixed set of reasons.

Examples may include:

cloud_fraction_too_high_after=0.40

insufficient_valid_pixels

below_change_threshold

seasonal_variation

but the frontend must support arbitrary future backend-provided reasons.

D. BACKEND CONNECTIVITY STATUS

Add an application-level backend connectivity check.

On application startup, call:

GET /stats

when:

VITE_USE_FIXTURES=false

If successful:

show system status:

BACKEND ONLINE

If unsuccessful:

show a clear global application banner/status:

BACKEND UNAVAILABLE

FastAPI service could not be reached.

Do not allow every screen to silently fail independently.

Individual pages must still display their own loading/error/empty states where appropriate.

When fixtures are enabled, show:

DEVELOPMENT / FIXTURE MODE

This must make it impossible to confuse fixture mode with the real production system.

E. FINAL RUNTIME ARCHITECTURE

Development:

React

  ↓

src/lib/api.ts

  ↓

development fixtures

Production/demo:

React

  ↓

src/lib/api.ts

  ↓

FastAPI

  ↓

SQLite + FAISS + ML

  ↓

REAL LOCALLY STORED SENTINEL-2 DATA

Copernicus is the ORIGINAL SOURCE of the imagery.

The running application does NOT contact Copernicus.

F. FINAL DATA PRINCIPLE

Do not claim that development fixtures are real satellite observations.

When VITE_USE_FIXTURES=true:

show "Development Fixture Mode"

When VITE_USE_FIXTURES=false:

show "Live Local Backend"

The final SIH demonstration must use:

VITE_USE_FIXTURES=false

and the real local FastAPI backend.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
