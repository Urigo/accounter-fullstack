# Authentication Architecture

## Overview

Accounter uses **Auth0** as the external identity provider for all user authentication. Auth0
handles credentials, JWT issuance, and session management. The local system handles business
authorization, roles, and permissions.

## Authentication Flow

1.  User navigates to login page
2.  Frontend redirects to Auth0 Universal Login
3.  User enters credentials
4.  Auth0 verifies credentials and issues JWT
5.  Frontend receives JWT and stores securely
6.  Frontend includes JWT in Authorization header for GraphQL requests
7.  Server verifies JWT signature using Auth0 JWKS endpoint
8.  Server maps Auth0 user ID to local business/role data
9.  Server enforces RLS using business_id from auth context

## Components

- **authPlugin**: Extracts JWT from Authorization header
- **AuthContextProvider**: Verifies JWT and maps to local user data
- **TenantAwareDBClient**: Enforces RLS using auth context
- **Auth0ManagementService**: Creates/manages Auth0 users via Management API

## Security Boundaries

- **Primary**: Row-Level Security (RLS) at database level
- **Secondary**: Application-level authorization checks
- **JWT Verification**: RS256 asymmetric signing, verified against Auth0 JWKS
- **Multi-Tenant Isolation**: Enforced by RLS policies on all tenant tables

## Configuration

See `packages/server/.env.example` for required Auth0 environment variables.
