-- Remove the former TaskRupt ad tracking feature. AdSense can be added separately.
drop table if exists public.ad_events;
