# NestJS E-commerce Backend

A robust e-commerce backend built with NestJS, TypeORM, and MySQL, featuring advanced authentication, shopping cart management, order processing, and caching mechanisms.

## 🚀 Key Features

### Authentication & Security

- JWT-based authentication with access and refresh tokens
- Refresh tokens stored in database for security
- HTTP-only cookie implementation for refresh tokens
- Custom security settings management

### User Management

- Profile creation and management
- Customizable user preferences
- Secure password management
- Session management for guest users

### Shopping Experience

- Product browsing by categories
- Advanced search functionality
- Wishlist management
- Dynamic cart management (both authenticated and guest users)
- Real-time price and stock notifications
- Order history tracking
- Order cancellation within designated period
- Customizable product sorting (price, rating, etc.)
- Session cart to database cart migration

### Technical Implementation

- Transaction management for data consistency
- Order snapshots for price consistency during checkout
- REPEATABLE READ isolation level for checkout process
- Custom global exception filter with detailed logging
- DTO validation using class-validator
- Redis caching implementation
- Custom decorators for:
  - Route authentication control
  - User data extraction
  - Cache management
  - Public route access

## 📦 Prerequisites

- Node.js (v20.x)
- MySQL (v8.0+)
- Redis (v5.x+)
- Docker & Docker Compose
- Yarn (v1.22+)

## 🛠️ Technology Stack

- **Framework:**
  - NestJS v10.0.0
  - Express v4.17
- **Database:**
  - MySQL2 v3.5.0
  - TypeORM v0.3.17
- **Caching:**
  - Redis (via ioredis v5.4.1)
  - @liaoliaots/nestjs-redis v10.0.0
- **Authentication:**
  - Passport v0.6.0
  - JWT (@nestjs/jwt v10.1.0)
  - bcrypt v5.1.0
- **Validation:**
  - class-validator v0.14.0
  - class-transformer v0.5.1
- **Session Management:**
  - cookie-session v2.0.0
  - express-session v1.18.0
- **Type Support:**
  - TypeScript v5.1.3
- **Development Tools:**
  - ESLint v8.42.0
  - Prettier v2.8.8
  - Jest v29.5.0

## 🚀 Installation

1. Clone the repository:

```bash
git clone [repository-url]
```

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env.development
```

4. Start Redis and MySQL using Docker:

```bash
docker-compose up -d
```

5. Start the application:

```bash
# Development
yarn start:dev

# Production build
yarn build
yarn start:prod
```

## 🏗️ Project Structure

```
src/
├── app.module.ts                # Main application module
├── main.ts                      # Application entry point
│
├── carts/                       # Cart management module
│   ├── controllers/            # Cart-related endpoints
│   │   ├── buy-now.controller.ts        # Direct purchase functionality
│   │   ├── session-cart.controller.ts    # Guest cart management
│   │   └── user-cart.controller.ts       # Authenticated user cart
│   ├── dtos/                  # Data transfer objects for cart operations
│   ├── services/              # Cart business logic
│   │   ├── buy-now-cart.service.ts      # Direct purchase processing
│   │   ├── cart-item.service.ts         # Cart item operations
│   │   ├── cart-utility.service.ts      # Shared cart utilities
│   │   ├── cart.service.ts              # Main cart operations
│   │   └── session-cart.service.ts      # Guest cart handling
│   └── types/                 # Cart-related type definitions
│
├── categories/                  # Category management
│   ├── category.controller.ts   # Category endpoints
│   ├── category.module.ts       # Category module configuration
│   ├── category.service.ts      # Category business logic
│   └── types/                  # Category-related types
│
├── common/                      # Shared utilities and middleware
│   ├── decorators/            # Custom decorators
│   │   ├── public.decorator.ts           # Public route marking
│   │   ├── user-uuid-from-cookie.ts      # User extraction from cookies
│   │   └── user.decorator.ts             # User data extraction
│   ├── errors/                # Error handling
│   │   ├── app-error.ts                  # Custom error definitions
│   │   └── global-exception-filter.ts    # Global error handler
│   ├── guards/                # Authentication guards
│   │   ├── at.guard.ts                   # Access token validation
│   │   └── rt.guard.ts                   # Refresh token validation
│   ├── middleware/            # Custom middleware
│   ├── services/             # Shared services
│   └── strategies/           # Passport authentication strategies
│
├── config/                      # Configuration files
│   └── database.config.ts       # Database configuration
│
├── entities/                    # Database entities
│   ├── Cart.entity.ts          # Cart model
│   ├── Order.entity.ts         # Order model
│   ├── Product.entity.ts       # Product model
│   ├── User.entity.ts          # User model
│   └── Wishlist.entity.ts      # Wishlist model
│
├── interceptors/                # Custom interceptors
│   └── serialize.interceptor.ts # Response serialization
│
├── orders/                      # Order processing module
│   ├── dtos/                  # Order data transfer objects
│   ├── services/              # Order processing logic
│   │   ├── order-utility.service.ts      # Order utilities
│   │   ├── order-validation.service.ts   # Order validation
│   │   └── order.service.ts              # Main order operations
│   └── types/                 # Order-related types
│       ├── checkout-snapshot.type.ts     # Order snapshot definition
│       └── checkoutType.enum.ts          # Checkout type enums
│
├── products/                    # Product management module
│   ├── controllers/           # Product-related endpoints
│   ├── dtos/                 # Product data transfer objects
│   ├── services/             # Product business logic
│   │   ├── product.service.ts            # Product operations
│   │   ├── review.service.ts             # Review management
│   │   └── wishlist.service.ts           # Wishlist operations
│   └── types/                # Product-related types
│
├── redis/                       # Redis caching implementation
│   ├── cache-result.decorator.ts # Cache decorator
│   ├── redis.module.ts          # Redis module configuration
│   └── redis.service.ts         # Redis service implementation
│
├── subcategories/               # Subcategory management
│   ├── dtos/                  # Subcategory DTOs
│   ├── enums/                 # Sorting and filtering enums
│   └── types/                 # Subcategory-related types
│
└── users/                       # User management module
    ├── controllers/           # User-related endpoints
    │   ├── auth.controller.ts            # Authentication endpoints
    │   └── user.controller.ts            # User operations
    ├── dtos/                  # User-related DTOs
    ├── services/              # User business logic
    │   ├── auth.service.ts               # Authentication service
    │   └── user.service.ts               # User management
    └── types/                 # User-related types
        ├── jwt-payload.type.ts           # JWT payload definition
        └── tokens.type.ts                # Token type definitions
```

## 🔐 Authentication

### Access Token

- JWT-based implementation
- Short-lived tokens for API access
- Passed via Authorization header

### Refresh Token

- Secure HTTP-only cookie implementation
- Stored in database for tracking and revocation
- Automatic token rotation

## 💾 Database Design

### Transaction Management

- ACID compliance for critical operations
- REPEATABLE READ isolation level for checkout process
- Optimistic locking for concurrent access

### Caching Strategy

- Redis implementation for reduced database load
- Intelligent cache invalidation
- Product-specific cache tracking

## 🔍 API Documentation

### Public Routes

- Product browsing
- Category listing
- Search functionality
- Guest cart management

### Protected Routes

- User profile management
- Order processing
- Wishlist management
- Cart operations

## 🚦 Error Handling

Custom exception filter providing:

- Detailed error logging
- User-friendly error messages
- Consistent error response format

## ⚡ Performance Optimizations

- Redis caching for frequently accessed data
- Efficient database querying with TypeORM
- Transaction management for data consistency
- Session management for guest users

## 🔄 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 👤 Author

Kutay Araz

- LinkedIn: https://www.linkedin.com/in/kutayaraz
- GitHub: https://github.com/KutayAraz
