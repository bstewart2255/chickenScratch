# Bottleneck Analysis Report

## 1. Database Connection Pool Exhaustion

**Observation:** The backend uses `node-postgres` (pg) with a `Pool` for database connections. The configuration in `db.js` and `server.js` does not specify a pool size, meaning it defaults to **10 connections**.

**Bottleneck:** A load of 1,000 concurrent users performing actions like registration or login will immediately exhaust the 10 available connections. Each request holds a connection open for the duration of a transaction, which involves multiple queries. New incoming requests will be queued, waiting for a connection to be released. This will lead to extremely long response times and, most likely, connection timeout errors.

**Recommendation:**
- **Increase Pool Size:** Start by significantly increasing the max pool size. A value between 50-100 would be a more reasonable starting point for this level of traffic.
- **Set Timeouts:** Configure `connectionTimeoutMillis` and `idleTimeoutMillis` on the pool to prevent requests from holding connections indefinitely and to gracefully handle idle connections.

## 2. Inefficient Database Writes During Registration

**Observation:** The `/register` endpoint inserts a new user and all their associated signatures, shapes, and drawings within a single database transaction. However, it does so by iterating through arrays and executing a separate `INSERT` statement for each individual record.

**Bottleneck:** Executing many sequential `INSERT` statements inside a loop creates significant overhead from network latency for each query. This holds the database transaction open for a prolonged period, tying up a valuable connection from the limited pool and increasing the likelihood of deadlocks under load.

**Recommendation:**
- **Bulk Inserts:** Modify the registration logic to perform bulk inserts. For PostgreSQL, you can use the `unnest` function or pass an array of values to a single `INSERT` statement. This would reduce dozens of queries per registration to just a few (e.g., one for the user, one for all signatures, one for all shapes).

## 3. CPU-Bound Operations Blocking the Event Loop

**Observation:** The `/login` endpoint performs complex, potentially slow calculations directly on the main Node.js thread. This includes:
- `calculateMLFeatures()`
- `compareSignaturesML()`
- Multiple scoring functions for shapes and drawings.

**Bottleneck:** Node.js uses a single-threaded event loop. CPU-intensive operations like these will block the entire server, preventing it from handling any other incoming requests until the calculation is complete. Under a load of 1,000 users, the server would become unresponsive as it tries to process these computations, leading to massive latency and request timeouts for all users.

**Recommendation:**
- **Offload to Worker Threads:** Move the ML feature calculation and comparison logic into Node.js `worker_threads`. This would allow the main thread to remain free to handle I/O and serve other requests while the heavy computations run in the background.
- **Dedicated ML Service:** For a more robust solution, offload all ML-related tasks to the dedicated Python ML service (`ml-model/`), which is better suited for CPU-bound work. The Node.js backend would simply make an API call to the ML service.

## 4. Non-Scalable In-Memory Storage

**Observation:** The backend uses a global `Map` object (`temporaryDrawingStorage`) to store user data during multi-step registration and login flows.

**Bottleneck:** This approach has two major flaws:
1.  **Memory Leaks:** While there is a basic `setInterval` cleanup, a surge of 1,000 users who start but do not complete the process could cause significant memory consumption, potentially crashing the server process.
2.  **Not Scalable:** This solution only works for a single server instance. In a production environment with multiple, load-balanced servers, there is no guarantee that a user's subsequent requests will hit the same instance that holds their temporary data, causing the flow to fail.

**Recommendation:**
- **Use a Distributed Cache:** Replace the in-memory `Map` with an external, shared cache like **Redis** or **Memcached**. This solves both the memory and scalability problems by providing a central, persistent store for temporary session data that all server instances can access.
