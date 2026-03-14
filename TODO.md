# FIFO Stock Management Implementation

## Steps:
- [x] 1. Add StockBalance Pydantic model
- [x] 2. Update POST /inward to insert stock_balances record
- [x] 3. Implement FIFO logic in POST /issue 
- [ ] 4. Update GET /stock to use balance aggregates (optional, aggregates still work)
- [x] 5. Add DB indexes in startup
- [ ] 6. Test endpoints

**Progress:** FIFO logic complete in backend. Stock aggregates unchanged (still correct). Ready for testing. Run server with `uvicorn backend.server:app --reload`.
