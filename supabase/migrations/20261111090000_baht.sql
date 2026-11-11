-- ============================================================================
--  Тайский бат — третья валюта игры (игры в Таиланде): все денежные
--  настройки × 35, налог на прибыль 20%. Пресет — в presets.ts.
-- ============================================================================

alter table games drop constraint if exists games_currency_check;
alter table games add constraint games_currency_check check (currency in ('USD', 'RUB', 'THB'));
