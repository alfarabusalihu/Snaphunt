# Changelog

All notable changes to Snaphunt will be documented in this file.

## [Unreleased]

### Added
- **Automatic Cloud-to-Local Fallback**: Qdrant now automatically falls back to local instance if cloud connection fails
- **Session Isolation**: Anonymous sessions no longer persist across browser closes
- **Unique Session IDs**: Each browser session gets a unique identifier to prevent cross-contamination
- **Stale State Detection**: Automatically clears incomplete analysis states on page reload
- **Smart Persistence**: Only authenticated users get persistent CV collections and work data
- **Connection Mode Indicator**: Shows whether using cloud or local Qdrant
- **Enhanced Error Handling**: Better error messages and automatic retry logic

### Changed
- **Session Storage**: Moved from sessionStorage to smart localStorage with authentication-based persistence
- **Qdrant Connection**: Simplified URL handling, automatic port detection, and connection testing
- **State Management**: Improved cleanup logic to prevent stale states from appearing
- **Documentation**: Comprehensive README with troubleshooting, architecture diagrams, and setup guides

### Fixed
- Issue where yesterday's analysis state persisted when reopening the app
- Qdrant connection errors with explicit port handling
- Anonymous user sessions persisting across browser sessions
- Stale analysis overlays blocking the configuration form

### Security
- Sensitive credentials now only in `.env` (excluded from git)
- Session data isolation between users
- No persistence of work data for anonymous users

## [1.0.0] - Initial Release

### Features
- PDF resume parsing and ingestion
- Vector-based candidate search using Qdrant
- AI-powered candidate analysis with Google Gemini
- User authentication and authorization
- Starred CVs functionality
- CV collection management
- Real-time analysis progress tracking
- Batch processing support
- OCR fallback for scanned PDFs
- JWT-based authentication
- MongoDB integration for persistence
