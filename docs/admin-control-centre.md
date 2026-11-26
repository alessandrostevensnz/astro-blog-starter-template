# ANDRO admin control centre
- /admin/ is the central launcher, with no private data shown before login.
- /admin/?view=editor opens the existing Decap CMS. Existing hash deep links remain supported. GitHub authentication and publishing remain unchanged.
- /analytics and /win/admin retain their original routes, middleware, database tables and protections. Signing in to either with the existing reports password issues the two existing scoped, HttpOnly, Secure, SameSite=Strict session cookies; both expire after eight hours. Signing out of either clears both dashboard cookies; the GitHub editor session and separate reports session are not changed.
- Previously issued individual dashboard sessions may require one new sign-in to establish both.
