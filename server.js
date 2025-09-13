const express = require("express");
const app = express();
app.use(express.json());

const licencasValidas = {
  "GOBLIN-1234": { usuario: "Vagner", expiracao: "2025-12-31" },
  "MU-TRIAL-777": { usuario: "Trial", expiracao: "2025-09-20" }
};

app.post("/validar", (req, res) => {
  const { chave } = req.body;
  const licenca = licencasValidas[chave];
  if (!licenca) return res.json({ valida: false });

  const hoje = new Date();
  const expira = new Date(licenca.expiracao);
  const ativa = hoje <= expira;

  res.json({ valida: ativa, usuario: licenca.usuario });
});

app.get("/", (req, res) => {
  res.send("Servidor de validação de licença ativo.");
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
