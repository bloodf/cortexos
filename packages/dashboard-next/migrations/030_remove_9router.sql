-- Migration 030: Remove 9Router from the service catalog.
DELETE FROM services WHERE slug = '9router';
