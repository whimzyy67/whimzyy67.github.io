-- Removes ONLY the pretend friends (and their follows). Your own account and data stay.
delete from auth.users where email like '%@test.whimzyy.invalid';
