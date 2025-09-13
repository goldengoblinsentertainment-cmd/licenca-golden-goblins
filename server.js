const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'golden-secret',
  resave: false,
  saveUninitialized: true
}));

// Caminhos absolutos para os arquivos
const clientesPath = path.join(__dirname, 'clientes.json');
const licencasPath = path.join(__dirname, 'licencas.json');

function authAdmin(req, res, next) {
  if (req.session?.logadoAdmin) next();
  else res.redirect('/admin');
}

function authCliente(req, res, next) {
  if (req.session?.cliente) next();
  else res.redirect('/cliente-login');
}

// Painel admin
app.get('/admin', (req, res) => {
  const licencas = JSON.parse(fs.readFileSync(licencasPath));
  const clientes = JSON.parse(fs.readFileSync(clientesPath));
  const logado = req.session.logadoAdmin;
  const busca = req.query.busca || '';

  let html = `
    <link rel="stylesheet" href="/style.css">
    <div class="container">
      <img src="/logo.png" class="logo" alt="Logo Golden Goblins">
      <h1>Painel de Licenças Golden Goblins</h1>
  `;

  if (!logado) {
    html += `
      <h2>Login Admin</h2>
      <form method="POST" action="/admin-login">
        <input name="usuario" placeholder="Usuário" required />
        <input name="senha" type="password" placeholder="Senha" required />
        <button type="submit">Entrar</button>
      </form>
    `;
  } else {
    html += `
      <form method="GET" action="/admin">
        <input name="busca" placeholder="Buscar cliente por nome" value="${busca}" />
        <button type="submit">Buscar</button>
      </form>

      <h2>Clientes registrados</h2>
      <table>
        <tr><th>Nome</th><th>Login</th><th>Email</th><th>Telefone</th><th>Dispositivo</th><th>IP</th><th>Chave</th></tr>
    `;
    clientes
      .filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
      .forEach(c => {
        html += `
          <tr>
            <td>${c.nome}</td>
            <td>${c.login}</td>
            <td>${c.email}</td>
            <td>${c.telefone}</td>
            <td>${c.dispositivo}</td>
            <td>${c.ip}</td>
            <td>${c.chave}</td>
          </tr>
        `;
      });
    html += `</table>

      <h2>Licenças</h2>
      <table>
        <tr><th>Chave</th><th>Status</th><th>Ações</th></tr>
    `;
    licencas.forEach(l => {
      html += `
        <tr>
          <td>${l.chave}</td>
          <td>${l.ativa ? 'Ativa' : 'Inativa'}</td>
          <td>
            <form method="POST" action="/excluir-licenca" style="display:inline">
              <input type="hidden" name="chave" value="${l.chave}" />
              <button type="submit">Excluir</button>
            </form>
          </td>
        </tr>
      `;
    });
    html += `</table>

      <h2>Gerar nova licença</h2>
      <form method="POST" action="/gerar-licenca">
        <button type="submit">Gerar chave aleatória</button>
      </form>

      <form method="GET" action="/admin-logout"><button>Sair</button></form>
    `;
  }

  html += `</div>`;
  res.send(html);
});

// Login admin
app.post('/admin-login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'admin' && senha === 'admin') {
    req.session.logadoAdmin = true;
  }
  res.redirect('/admin');
});

app.get('/admin-logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// Gerar nova licença
app.post('/gerar-licenca', authAdmin, (req, res) => {
  const licencas = JSON.parse(fs.readFileSync(licencasPath));
  const novaChave = 'GOBLIN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  licencas.push({ chave: novaChave, ativa: true });
  fs.writeFileSync(licencasPath, JSON.stringify(licencas, null, 2));
  console.log('Licença gerada:', novaChave);
  res.redirect('/admin');
});

// Excluir licença
app.post('/excluir-licenca', authAdmin, (req, res) => {
  const { chave } = req.body;
  let licencas = JSON.parse(fs.readFileSync(licencasPath));
  licencas = licencas.filter(l => l.chave !== chave);
  fs.writeFileSync(licencasPath, JSON.stringify(licencas, null, 2));
  res.redirect('/admin');
});

// Registro de cliente
app.get('/registro', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ip = ip.replace(/^.*:/, '');
  res.send(`
    <link rel="stylesheet" href="/style.css">
    <div class="container">
      <img src="/logo.png" class="logo" alt="Logo Golden Goblins">
      <h1>Registro de Cliente</h1>
      <form method="POST" action="/registro">
        <input name="nome" placeholder="Nome completo" required />
        <input name="login" placeholder="Login desejado" required />
        <input name="senha" type="password" placeholder="Senha" required />
        <input name="telefone" placeholder="Telefone" required />
        <input name="email" placeholder="E-mail" required />
        <input name="dispositivo" placeholder="ID do dispositivo" required />
        <input name="chave" placeholder="Chave de licença" required />
        <input value="${ip}" disabled />
        <input type="hidden" name="ip" value="${ip}" />
        <button type="submit">Registrar</button>
      </form>
    </div>
  `);
});

app.post('/registro', (req, res) => {
  const { nome, login, senha, telefone, email, dispositivo, chave, ip } = req.body;
  const licencas = JSON.parse(fs.readFileSync(licencasPath));
  const clientes = JSON.parse(fs.readFileSync(clientesPath));

  const chaveValida = licencas.find(l => l.chave === chave && l.ativa);
  const jaRegistrado = clientes.find(c => c.chave === chave);
  const loginExistente = clientes.find(c => c.login === login);

  if (!chaveValida) return res.send('Chave inválida ou inativa.');
  if (jaRegistrado) return res.send('Essa chave já foi registrada.');
  if (loginExistente) return res.send('Este login já está em uso.');

  clientes.push({ nome, login, senha, telefone, email, dispositivo, chave, ip });

  try {
    fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2));
    console.log('Cliente registrado:', login);
    res.send('Registro concluído com sucesso!');
  } catch (err) {
    console.error('Erro ao salvar cliente:', err);
    res.status(500).send('Erro ao registrar cliente.');
  }
});

// Login cliente
app.get('/cliente-login', (req, res) => {
  res.send(`
    <link rel="stylesheet" href="/style.css">
    <div class="container">
      <h1>Login do Cliente</h1>
      <form method="POST" action="/cliente-login">
        <input name="login" placeholder="Login" required />
        <input name="senha" type="password" placeholder="Senha" required />
        <button type="submit">Entrar</button>
      </form>
    </div>
  `);
});

app.post('/cliente-login', (req, res) => {
  const { login, senha } = req.body;
  const clientes = JSON.parse(fs.readFileSync(clientesPath));
  const cliente = clientes.find(c => c.login === login && c.senha === senha);
  if (cliente) {
    req.session.cliente = cliente;
    res.redirect('/painel-cliente');
