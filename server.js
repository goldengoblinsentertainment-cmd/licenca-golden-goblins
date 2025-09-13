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

function authAdmin(req, res, next) {
  if (req.session && req.session.logadoAdmin) {
    next();
  } else {
    res.redirect('/admin');
  }
}

function authCliente(req, res, next) {
  if (req.session && req.session.cliente) {
    next();
  } else {
    res.redirect('/cliente-login');
  }
}

app.get('/admin', (req, res) => {
  const licencas = JSON.parse(fs.readFileSync('licencas.json'));
  const clientes = JSON.parse(fs.readFileSync('clientes.json'));
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

app.post('/admin-login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'admin' && senha === 'admin') {
    req.session.logadoAdmin = true;
  }
  res.redirect('/admin');
});

app.get('/admin-logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

app.post('/gerar-licenca', authAdmin, (req, res) => {
  const licencas = JSON.parse(fs.readFileSync('licencas.json'));
  const novaChave = 'GOBLIN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  licencas.push({ chave: novaChave, ativa: true });
  fs.writeFileSync('licencas.json', JSON.stringify(licencas, null, 2));
  res.redirect('/admin');
});

app.post('/excluir-licenca', authAdmin, (req, res) => {
  const { chave } = req.body;
  let licencas = JSON.parse(fs.readFileSync('licencas.json'));
  licencas = licencas.filter(l => l.chave !== chave);
  fs.writeFileSync('licencas.json', JSON.stringify(licencas, null, 2));
  res.redirect('/admin');
});

app.get('/registro', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ip = ip.replace(/^.*:/, ''); // remove prefixos como ::ffff:
  
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
  const licencas = JSON.parse(fs.readFileSync('licencas.json'));
  const clientes = JSON.parse(fs.readFileSync('clientes.json'));

  const chaveValida = licencas.find(l => l.chave === chave && l.ativa);
  const jaRegistrado = clientes.find(c => c.chave === chave);
  const loginExistente = clientes.find(c => c.login === login);

  if (!chaveValida) return res.send('Chave inválida ou inativa.');
  if (jaRegistrado) return res.send('Essa chave já foi registrada.');
  if (loginExistente) return res.send('Este login já está em uso.');

  clientes.push({ nome, login, senha, telefone, email, dispositivo, chave, ip });
  fs.writeFileSync('clientes.json', JSON.stringify(clientes, null, 2));
  res.send('Registro concluído com sucesso!');
});

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
  const clientes = JSON.parse(fs.readFileSync('clientes.json'));
  const cliente = clientes.find(c => c.login === login && c.senha === senha);
  if (cliente) {
    req.session.cliente = cliente;
    res.redirect('/painel-cliente');
  } else {
    res.send('Login ou senha inválidos.');
  }
});

app.get('/painel-cliente', authCliente, (req, res) => {
  const c = req.session.cliente;
  res.send(`
    <link rel="stylesheet" href="/style.css">
    <div class="container">
      <h1>Bem-vindo, ${c.nome}</h1>
      <p><strong>Login:</strong> ${c.login}</p>
      <p><strong>Email:</strong> ${c.email}</p>
      <p><strong>Telefone:</strong> ${c.telefone}</p>
      <p><strong>Dispositivo:</strong> ${c.dispositivo}</p>
      <p><strong>IP registrado:</strong> ${c.ip}</p>
      <p><strong>Chave de licença:</strong> ${c.chave}</p>

      <h2>Alterar senha</h2>
      <form method="POST" action="/editar-senha">
        <input name="novaSenha" type="password" placeholder="Nova senha" required />
        <button type="submit">Atualizar senha</button>
      </form>

      <form method="GET" action="/cliente-logout">
        <button>Sair</button>
      </form>
    </div>
  `);
});


app.post('/editar-senha', authCliente, (req, res) => {
  const { novaSenha } = req.body;
  const clientes = JSON.parse(fs.readFileSync('clientes.json'));
  const loginAtual = req.session.cliente.login;

  const cliente = clientes.find(c => c.login === loginAtual);
  if (cliente) {
    cliente.senha = novaSenha;
    fs.writeFileSync('clientes.json', JSON.stringify(clientes, null, 2));
    req.session.cliente = cliente;
    res.send(`
      <link rel="stylesheet" href="/style.css">
      <div class="container">
        <h1>Senha atualizada com sucesso!</h1>
        <a href="/painel-cliente"><button>Voltar ao painel</button></a>
      </div>
    `);
  } else {
    res.send('Erro ao atualizar senha.');
  }
});

app.get('/cliente-logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/cliente-login');
  });
});

app.post('/validar', (req, res) => {
  const { chave, dispositivo } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const clientes = JSON.parse(fs.readFileSync('clientes.json'));

  const cliente = clientes.find(c =>
    c.chave === chave &&
    c.dispositivo === dispositivo &&
    c.ip === ip
  );

  if (cliente) {
    res.json({ valida: true, usuario: cliente.nome });
  } else {
    res.json({ valida: false });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <link rel="stylesheet" href="/style.css">
    <div class="container">
      <img src="/logo.png" class="logo" alt="Logo Golden Goblins">
      <h1>Bem-vindo ao sistema Golden Goblins</h1>
      <p>Escolha uma opção abaixo:</p>

      <div style="display:flex; gap:20px; justify-content:center; margin-top:20px; flex-wrap:wrap;">
        <form method="GET" action="/admin">
          <button style="padding:10px 20px;">Painel do Administrador</button>
        </form>

        <form method="GET" action="/registro">
          <button style="padding:10px 20px;">Registro de Cliente</button>
        </form>

        <form method="GET" action="/cliente-login">
          <button style="padding:10px 20px;">Login do Cliente</button>
        </form>
      </div>
    </div>
  `);
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});

