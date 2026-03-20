# RBSchool API Documentation

## 📚 Overview

RBSchool Management System provides comprehensive REST APIs for school management operations. The system is built using microservices architecture with the following services:

## 🚀 Services & Ports

| Service | Port | Description | Documentation |
|---------|------|-------------|---------------|
| **API Gateway** | 8000 | Single entry point for all APIs | [http://localhost:8000/api-docs](http://localhost:8000/api-docs) |
| **Auth Service** | 3001 | Authentication & Authorization | [http://localhost:3001/api-docs](http://localhost:3001/api-docs) |
| **User Service** | 3002 | User Profile Management | [http://localhost:3002/api-docs](http://localhost:3002/api-docs) |
| **Academic Service** | 3003 | Classes, Subjects, Timetable | [http://localhost:3003/api-docs](http://localhost:3003/api-docs) |
| **Attendance Service** | 3004 | Student Attendance Tracking | [http://localhost:3004/api-docs](http://localhost:3004/api-docs) |
| **Fee Service** | 3005 | Fee Management & Invoicing | [http://localhost:3005/api-docs](http://localhost:3005/api-docs) |
| **Notification Service** | 3006 | Notifications & Alerts | [http://localhost:3006/api-docs](http://localhost:3006/api-docs) |
| **School Service** | 3007 | School Information Management | [http://localhost:3007/api-docs](http://localhost:3007/api-docs) |

## 🔐 Authentication

All API endpoints (except auth endpoints) require JWT authentication:

```bash
# Get JWT Token
POST /auth/login
{
  "email": "admin@demo.com",
  "password": "admin123",
  "schoolId": "your-school-id"
}

# Use token in headers
Authorization: Bearer <your-jwt-token>
```

## 📖 API Documentation

### Swagger/OpenAPI Documentation

Each service provides interactive API documentation:

1. **API Gateway**: [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
2. **Auth Service**: [http://localhost:3001/api-docs](http://localhost:3001/api-docs)
3. **User Service**: [http://localhost:3002/api-docs](http://localhost:3002/api-docs)
4. **Academic Service**: [http://localhost:3003/api-docs](http://localhost:3003/api-docs)
5. **Attendance Service**: [http://localhost:3004/api-docs](http://localhost:3004/api-docs)
6. **Fee Service**: [http://localhost:3005/api-docs](http://localhost:3005/api-docs)
7. **Notification Service**: [http://localhost:3006/api-docs](http://localhost:3006/api-docs)
8. **School Service**: [http://localhost:3007/api-docs](http://localhost:3007/api-docs)

### Features of Swagger Documentation:
- 📖 Interactive API testing
- 🔍 Request/Response examples
- 📝 Parameter descriptions
- 🔐 Authentication examples
- 🚀 Try it out functionality

## 📋 Postman Collection

Complete Postman collection is available: `RBSchool-API-Collection.postman_collection.json`

### Importing Postman Collection:
1. Open Postman
2. Click "Import" button
3. Select "RBSchool-API-Collection.postman_collection.json"
4. All APIs will be imported with:
   - ✅ Pre-configured environments
   - 🔐 Authentication variables
   - 📝 Sample requests
   - 🔄 Auto-token management

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
# Run the setup script
./setup-swagger.bat
```

### 2. Start Services
```bash
# Using Docker (Recommended)
docker-compose up --build -d

# Or locally
npm run dev
```

### 3. Access Documentation
- Open any service documentation URL in browser
- Use Postman collection for API testing
- Check API Gateway for unified documentation

## 📊 Key API Endpoints

### Authentication Service
```
POST /auth/register-school    # Register new school
POST /auth/login              # User login
POST /auth/send-otp           # Send OTP
POST /auth/verify-otp         # Verify OTP
POST /auth/refresh            # Refresh token
POST /auth/logout             # Logout
POST /auth/change-password    # Change password
```

### User Service
```
GET  /users/profile           # Get user profile
PUT  /users/profile           # Update profile
GET  /users                   # Get all users (with filters)
```

### Academic Service
```
GET  /academics/classes       # Get classes
POST /academics/classes       # Create class
GET  /academics/subjects      # Get subjects
POST /academics/subjects      # Create subject
```

### Attendance Service
```
POST /attendance/mark         # Mark attendance
GET  /attendance/report       # Get attendance report
GET  /attendance/summary      # Get attendance summary
```

### Fee Service
```
POST /fee/structures          # Create fee structure
POST /fee/invoices            # Generate invoice
GET  /fee/status/:studentId   # Get fee status
```

### Notification Service
```
POST /notifications/send      # Send notification
GET  /notifications           # Get notifications
PUT  /notifications/:id/read  # Mark as read
```

### School Service
```
GET  /school/info             # Get school info
PUT  /school/info             # Update school info
GET  /school/settings         # Get settings
```

## 🔧 Environment Variables

Each service uses its own `.env` file. Key variables:

```env
# Database
MONGODB_URI=mongodb://localhost:PORT/database-name

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
# ... etc
```

## 🚨 Error Handling

All APIs follow consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 📝 Response Format

Success responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 Rate Limiting

- **Global**: 100 requests per minute
- **Auth endpoints**: 10 requests per minute
- **Other endpoints**: 60 requests per minute

## 🛡️ Security Features

- 🔐 JWT Authentication
- 🚫 Rate Limiting
- 🛡️ CORS Protection
- 📝 Request Validation
- 🔒 Password Hashing
- 📊 Security Headers

## 📞 Support

For API support:
- 📧 Email: support@rbschool.com
- 📖 Documentation: Available at each service's `/api-docs`
- 🧪 Testing: Use Postman collection
- 📊 Monitoring: Check `/health` endpoints

---

**Note**: Make sure all services are running before accessing API documentation. Use the provided batch files for easy service management.
