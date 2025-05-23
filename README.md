# Jogou Baixou Backend

This is the backend server for the Jogou Baixou file sharing application. It provides API endpoints for uploading and downloading files with enhanced security measures.

## Features

- File upload with Multer and comprehensive security validation
- File download with unique ID and secure access controls
- File expiration after 1 minute with automatic cleanup
- TypeScript support with strict type checking
- Comprehensive security measures against common web vulnerabilities

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

The server will run on http://localhost:3001 by default.

## API Endpoints

- `POST /api/upload` - Upload a file (multipart/form-data with 'file' field)
- `GET /api/file/:id` - Get file information
- `GET /api/download/:id` - Download a file

## Security Measures

This application implements comprehensive security measures to protect against common web vulnerabilities:

### HTTP Security
- **Helmet**: Secures HTTP headers to prevent various attacks
- **Content Security Policy (CSP)**: Restricts resource loading to prevent XSS attacks
- **CORS Protection**: Restricts cross-origin requests to trusted domains only
- **XSS Protection**: Multiple layers of protection against cross-site scripting
- **Clickjacking Protection**: Prevents the application from being embedded in iframes

### File Upload Security
- **File Size Limits**: Restricts uploads to 10MB maximum
- **MIME Type Validation**: Validates file types against an allowlist
- **Filename Sanitization**: Prevents path traversal and malicious filenames
- **Secure Storage**: Files are stored with randomized names and proper permissions
- **Extension Validation**: Blocks potentially dangerous file extensions
- **Content Validation**: Basic checks for executable content in uploads

### API Security
- **Rate Limiting**: Prevents brute force and DoS attacks
- **Input Validation**: Validates all user inputs using Zod schemas
- **UUID Validation**: Ensures file IDs match expected UUID format
- **Path Traversal Prevention**: Blocks attempts to access files outside allowed directories
- **Error Handling**: Provides appropriate errors without leaking system information

### Environment Security
- **Environment Variables**: Secure configuration via .env files
- **Schema Validation**: Validates all environment variables at startup
- **Secure Defaults**: Provides secure defaults when environment variables are missing

## Build for Production

```bash
npm run build
npm start
```
