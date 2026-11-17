# Funções

Aplicar as duas migrações datadas de 20261117, na ordem. Definir `IP_SALT` aleatório e estável e `ALLOWED_ORIGIN` (origem do site; `*` permitido no piloto). SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são fornecidas pelo ambiente Supabase. Nunca colocar a chave de serviço em VITE_*.

```sh
supabase secrets set IP_SALT=<segredo> ALLOWED_ORIGIN=https://seu-site.vercel.app
supabase functions deploy submit-report --no-verify-jwt
supabase functions deploy purge-photos
```

submit-report é público, com cota atômica de 10 criações/IP/dia UTC. O proxy confiável do Supabase deve sobrescrever x-forwarded-for. finalize exige a capacidade aleatória devolvida em create, além do ID, e só aceita caminhos registrados. Não registrar tokens ou IPs nos logs. URLs de upload expiram conforme o Storage. Purge verifica JWT e is_admin com o token do chamador antes de usar o cliente de serviço.
