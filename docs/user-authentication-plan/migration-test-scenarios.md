## Auth0 Migration Test Scenarios

### Test User Matrix

| Email                       | Role           | Auth0 Status | Test Scenarios               |
| --------------------------- | -------------- | ------------ | ---------------------------- |
| owner-test@example.com      | business_owner | Active       | Full access, user management |
| accountant-test@example.com | accountant     | Active       | Financial data access        |
| employee-test@example.com   | employee       | Active       | Limited access               |
| scraper-test@example.com    | scraper        | Blocked      | API key auth only            |

### Critical Test Scenarios

1. **Login Flow**:
   - [ ] User logs in via Auth0 Universal Login
   - [ ] JWT token issued and verified
   - [ ] Auth context populated correctly
   - [ ] Business/role data mapped correctly

2. **Authorization**:
   - [ ] Business owner can access all features
   - [ ] Accountant restricted from user management
   - [ ] Employee cannot view salary data
   - [ ] API key authentication works independently

3. **Multi-Tenant Isolation**:
   - [ ] User from business A cannot access business B data
   - [ ] RLS policies enforced correctly
   - [ ] Cross-business queries blocked

4. **Edge Cases**:
   - [ ] Expired JWT rejected
   - [ ] Invalid JWT signature rejected
   - [ ] User not in local database returns null context
   - [ ] Concurrent requests isolated correctly

### Rollback Test

- [ ] Toggle USE_AUTH0=false
- [ ] Restart server
- [ ] Verify old auth works
- [ ] Confirm < 1 minute downtime
