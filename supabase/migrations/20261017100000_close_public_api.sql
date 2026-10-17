-- ============================================================================
--  Закрыть прямой доступ к рейтингу через публичный ключ.
--
--  Сайт работает только через функцию game, а она ходит в базу своей ролью.
--  Но Supabase по умолчанию открывает новые представления и функции схемы
--  public ролям anon и authenticated — тем, с кем приходит публичный ключ
--  сайта. Таблицы закрыты RLS, а представление v_standings выполняется с
--  правами владельца, мимо RLS, — и через REST API любой мог прочитать его,
--  с почтами игроков. Функцию player_ratings тоже мог вызвать любой.
--
--  Закрываем оба и снимаем такие права по умолчанию для будущих объектов.
--  Функция game этим не затронута.
-- ============================================================================

alter view v_standings set (security_invoker = on);
revoke all on v_standings from public;
revoke execute on function player_ratings(text) from public;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on v_standings from %I', r);
      execute format('revoke execute on function player_ratings(text) from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;
