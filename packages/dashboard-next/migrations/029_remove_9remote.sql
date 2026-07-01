-- Migration 029: Remove 9Remote from the service catalog.
--
-- 9Remote has been decommissioned on this host (service stopped, npm package
-- removed, data directory deleted). Drop its dashboard row so it no longer
-- appears in health checks or the service catalog.

DELETE FROM services WHERE slug = '9remote';
