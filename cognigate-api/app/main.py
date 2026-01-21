"""
Cognigate Engine - Main FastAPI Application

The operational engine that enforces the BASIS standard for AI agent governance.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response

from app.config import get_settings
from app.routers import enforce, intent, proof, health, admin

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info(
        "cognigate_starting",
        version=settings.app_version,
        environment=settings.environment,
    )
    yield
    logger.info("cognigate_shutdown")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
## Cognigate Engine

The operational engine that enforces the **BASIS** standard for AI agent governance.

### Core Endpoints

- **INTENT** (`/v1/intent`) - Normalize and validate agent intentions
- **ENFORCE** (`/v1/enforce`) - Evaluate intentions against BASIS policies
- **PROOF** (`/v1/proof`) - Generate and verify cryptographic evidence

### The Stack

```
BASIS sets the rules.
INTENT figures out the goal.
ENFORCE stops the bad stuff.
PROOF shows the receipts.
```

Powered by **VORION** - The Steward of Safe Autonomous Systems.
    """,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware - Define who can access the brain
origins = [
    "http://localhost:3000",       # Local Frontend
    "https://vorion.org",          # Production Frontend
    "https://www.vorion.org",      # Production Redirect
    "https://cognigate.dev",       # Dev Portal
    "https://vorion-www.vercel.app",  # Vercel Preview
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(intent.router, prefix=settings.api_prefix, tags=["Intent"])
app.include_router(enforce.router, prefix=settings.api_prefix, tags=["Enforce"])
app.include_router(proof.router, prefix=settings.api_prefix, tags=["Proof"])
app.include_router(admin.router, prefix=settings.api_prefix, tags=["Admin"])


# Mount static files
static_path = Path(__file__).parent.parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serve favicon."""
    favicon_path = static_path / "favicon.png"
    if favicon_path.exists():
        return FileResponse(str(favicon_path), media_type="image/png")
    return FileResponse(str(favicon_path))


@app.get("/", include_in_schema=False)
async def root():
    """Serve the landing page."""
    index_path = static_path / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    # Fallback to docs if landing page doesn't exist
    return HTMLResponse(
        content='<html><head><meta http-equiv="refresh" content="0;url=/docs"></head></html>',
        status_code=200,
    )


@app.get("/status", include_in_schema=False)
async def status_page():
    """Serve the system status page."""
    status_path = static_path / "status.html"
    if status_path.exists():
        return FileResponse(str(status_path), media_type="text/html")
    # Fallback to health endpoint if status page doesn't exist
    return HTMLResponse(
        content='<html><head><meta http-equiv="refresh" content="0;url=/health"></head></html>',
        status_code=200,
    )


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    """Serve robots.txt for search engine crawlers."""
    content = """User-agent: *
Allow: /

Sitemap: https://cognigate.dev/sitemap.xml
"""
    return PlainTextResponse(content=content, media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    """Serve sitemap.xml for search engines."""
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")

    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cognigate.dev/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cognigate.dev/docs</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://cognigate.dev/status</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://cognigate.dev/redoc</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
"""
    return Response(content=content, media_type="application/xml")
