- Winrate from int to float
- “Funil de vendas” adjust the enums to translate from numbers to properties

---

- [ ] BACKEND - Converter um lead para “Ganho” cria dois usuários na tabela de clientes
- [ ] BACKEND - `GET /api/offices/:id/crm/metrics` retornar `stages` `status` e `source` pelo nome do enum ao invés do número
- [ ] FRONTEND - O status do lead não está sendo respeitado na criação por colunas
- [ ] BACKEND - `GET api/offices/:id/crm/leads/:lead/full` está fora da convenção REST, deveria ser `GET api/offices/:id/crm/leads/:lead` 
- [ ] BACKEND - `GET api/offices/:id/crm/leads` deve retornar `temperature` na listagem