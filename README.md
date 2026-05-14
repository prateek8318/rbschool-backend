# RBSchool Management System

A comprehensive school management system built with microservices architecture, featuring complete API documentation, real-time notifications, and easy deployment.

## 🏗️ Architecture Overview

RBSchool is designed as a scalable microservices-based system with the following components:

### Core Services
| Service | Port | Description |
|---------|------|-------------|
| **API Gateway** | 8000 | Single entry point, routing & authentication |
| **Auth Service** | 3001 | Authentication & authorization |
| **User Service** | 3002 | User profile management |
| **Academic Service** | 3003 | Classes, subjects, timetable |
| **Attendance Service** | 3004 | Student attendance tracking |
| **Fee Service** | 3005 | Fee management & invoicing |
| **Notification Service** | 3006 | Real-time notifications & alerts |
| **School Service** | 3007 | School information & settings |

### Infrastructure
- **PostgreSQL (Supabase)**: Centralized database using Prisma ORM
- **Redis**: Pub/Sub for async events & caching
- **Shared Package**: Common utilities at `packages/shared`
- **Docker**: Containerized deployment (Redis & Services)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase / PostgreSQL instance
- Redis (or use Docker)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rbschool-backend

# Install dependencies
npm install

# Build shared packages
npm run build:shared
```

### Development Mode

```bash
# Start all services in development mode
npm run dev

# Or start individual services
npm run dev -w api-gateway
npm run dev -w auth-service
# ... etc for other services
```

### Production Deployment

#### Using Docker (Recommended)
```bash
# Start all services with Docker
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

#### Manual Deployment
```bash
# Build all services
npm run build

# Start services individually (production mode)
npm run start -w api-gateway
npm run start -w auth-service
# ... etc
```

## 📚 API Documentation

Complete API documentation is available at:
- **Interactive Swagger Docs**: [API Documentation.md](./API-Documentation.md)
- **Postman Collection**: `RBSchool-API-Collection.postman_collection.json`

### Accessing API Documentation
Once services are running, visit:
- **Gateway**: http://localhost:8000/api-docs
- **Auth Service**: http://localhost:3001/api-docs
- **Other Services**: Replace port accordingly (3002-3007)

## 🔐 Authentication Flow

1. **Register School**: `POST /auth/register-school`
2. **Login**: `POST /auth/login` (returns JWT token)
3. **API Access**: Include `Authorization: Bearer <token>` header
4. **Token Refresh**: `POST /auth/refresh`

## 🛠️ Configuration

### Environment Setup
Each service uses its own `.env` file. Copy from `.env.example`:

```bash
# For each service
cp services/auth-service/.env.example services/auth-service/.env
# ... repeat for other services
```

### Key Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/service-name

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h

# Service Configuration
PORT=3001
NODE_ENV=development
```

## 🏛️ System Design

### Communication Patterns
- **Gateway Headers**: Services trust `x-user-id`, `x-user-role`, `x-school-id`
- **Cross-service Reads**: Internal HTTP calls
- **Async Operations**: Redis Pub/Sub events
- **Data Consistency**: Event-driven architecture

### Security Features
- JWT-based authentication
- Role-based access control
- Rate limiting
- CORS protection
- Input validation
- Password hashing

## 📊 Monitoring & Health

### Health Endpoints
Each service provides:
- `GET /health` - Service health status
- `GET /health/detailed` - Detailed system info

### Monitoring Setup
```bash
# Check all service health
curl http://localhost:8000/health
curl http://localhost:3001/health
# ... etc for other services
```

## 🧪 Development Guidelines

### Code Structure
```
services/
├── auth-service/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── .env
│   ├── Dockerfile
│   └── package.json
```

### Adding New Services
1. Create service directory under `services/`
2. Add to `package.json` workspaces
3. Update `docker-compose.yml`
4. Add to main `package.json` scripts
5. Update API documentation

## 🔧 Troubleshooting

### Common Issues

**Port Conflicts**
```bash
# Check what's running on ports
netstat -tulpn | grep :3001
# Or use different ports in .env files
```

**MongoDB Connection**
```bash
# Ensure MongoDB is running
docker ps | grep mongo
# Check connection string in .env
```

**Redis Connection**
```bash
# Test Redis connection
redis-cli ping
```

### Service Dependencies
- `auth-service` depends on `school-service`
- `api-gateway` depends on all other services
- All services depend on `mongodb` and `redis`

## 📝 Migration Notes

- ✅ Legacy monolith architecture migrated to microservices
- ✅ Business rules preserved in new services
- ✅ Data models optimized for distributed architecture
- ✅ API compatibility maintained where possible

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📞 Support

For support and questions:
- 📧 Email: support@rbschool.com
- 📖 Documentation: [API Documentation.md](./API-Documentation.md)
- 🐛 Issues: Create GitHub issue
- 📊 Monitoring: Check service health endpoints

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: Make sure all services are running before accessing API documentation. Use the provided npm scripts for easy service management.
