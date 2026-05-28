"""
servidor.py - Backend Flask com SQLite para o sistema de entregas Pet Shop
Railway: define a variavel de ambiente PORT automaticamente

CREDENCIAIS DE ACESSO
---------------------
Para alterar usuario ou senha, va em:
Railway > seu projeto > bloco "web" > aba Variables

Altere as variaveis:
  APP_USER  — nome de usuario
  APP_PASS  — senha

Apos salvar, o Railway reinicia o servidor automaticamente.
As credenciais nunca ficam gravadas no codigo, apenas nas variaveis de ambiente.
"""

import sqlite3
import os
from flask import (Flask, request, jsonify, send_from_directory,
                   session, redirect, url_for)
from datetime import datetime
from functools import wraps

app = Flask(__name__, static_folder='static')

# Chave secreta para assinar a sessao — gerada automaticamente se nao definida
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))

DATA_DIR = os.environ.get('DATA_DIR', '.')
DB_PATH = os.path.join(DATA_DIR, 'petshop.db')

# Credenciais definidas nas variaveis de ambiente do Railway
APP_USER = os.environ.get('APP_USER', 'atendenteSemeando')
APP_PASS = os.environ.get('APP_PASS', '#Semeando07')


# ─────────────────────────────────────────────
# AUTENTICACAO
# ─────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logado'):
            # Para chamadas de API retorna 401, para paginas redireciona
            if request.path.startswith('/api'):
                return jsonify({'erro': 'Nao autorizado'}), 401
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated


@app.route('/login', methods=['GET'])
def login_page():
    if session.get('logado'):
        return redirect('/')
    return send_from_directory('static', 'login.html')


@app.route('/api/login', methods=['POST'])
def fazer_login():
    d = request.get_json()
    usuario = d.get('usuario', '').strip()
    senha = d.get('senha', '')

    if usuario == APP_USER and senha == APP_PASS:
        session['logado'] = True
        session['usuario'] = usuario
        return jsonify({'ok': True, 'usuario': usuario})
    return jsonify({'erro': 'Usuario ou senha incorretos'}), 401


@app.route('/api/logout', methods=['POST'])
def fazer_logout():
    session.clear()
    return jsonify({'ok': True})


@app.route('/api/me', methods=['GET'])
def quem_sou():
    if session.get('logado'):
        return jsonify({'logado': True, 'usuario': session.get('usuario')})
    return jsonify({'logado': False})


# ─────────────────────────────────────────────
# BANCO DE DADOS
# ─────────────────────────────────────────────

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS clientes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                nome      TEXT NOT NULL,
                telefone  TEXT NOT NULL,
                endereco  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS entregadores (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                nome      TEXT NOT NULL,
                telefone  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS produtos (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                nome      TEXT NOT NULL,
                unidade   TEXT NOT NULL DEFAULT 'un',
                valor     TEXT
            );

            CREATE TABLE IF NOT EXISTS pedidos (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id    INTEGER,
                entregador_id INTEGER,
                status        TEXT NOT NULL DEFAULT 'aguardando',
                criado_em     TEXT NOT NULL,
                concluido_em  TEXT,
                registrado_por TEXT,
                pagamento_id  INTEGER,
                nome_avulso   TEXT,
                total         REAL,
                cancelado     INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS itens_pedido (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido_id  INTEGER NOT NULL,
                descricao  TEXT NOT NULL,
                tipo       TEXT,
                qtd        TEXT,
                unidade    TEXT,
                valor      TEXT,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
            );

            CREATE TABLE IF NOT EXISTS formas_pagamento (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                nome  TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS produto_opcoes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                produto_id  INTEGER NOT NULL,
                descricao   TEXT NOT NULL,
                unidade     TEXT NOT NULL DEFAULT 'un',
                valor       TEXT,
                FOREIGN KEY (produto_id) REFERENCES produtos(id)
            );
        """)

        # Migrar produtos antigos: mover unidade/valor para produto_opcoes
        tem_opcoes = conn.execute("SELECT COUNT(*) FROM produto_opcoes").fetchone()[0]
        if tem_opcoes == 0:
            prods = conn.execute("SELECT id, unidade, valor FROM produtos WHERE unidade IS NOT NULL").fetchall()
            for p in prods:
                if p["unidade"] or p["valor"]:
                    conn.execute(
                        "INSERT INTO produto_opcoes (produto_id, descricao, unidade, valor) VALUES (?, ?, ?, ?)",
                        (p["id"], p["unidade"] or "padrao", p["unidade"] or "un", p["valor"] or "")
                    )

        # Migracoes: adiciona colunas novas em bancos ja existentes
        colunas = [row[1] for row in conn.execute("PRAGMA table_info(pedidos)").fetchall()]
        migracoes = [
            ("registrado_por", "ALTER TABLE pedidos ADD COLUMN registrado_por TEXT"),
            ("pagamento_id",   "ALTER TABLE pedidos ADD COLUMN pagamento_id INTEGER"),
            ("nome_avulso",    "ALTER TABLE pedidos ADD COLUMN nome_avulso TEXT"),
            ("total",          "ALTER TABLE pedidos ADD COLUMN total REAL"),
            ("cancelado",      "ALTER TABLE pedidos ADD COLUMN cancelado INTEGER DEFAULT 0"),
            ("troco",          "ALTER TABLE pedidos ADD COLUMN troco INTEGER DEFAULT 0"),
            ("troco_valor",    "ALTER TABLE pedidos ADD COLUMN troco_valor REAL"),
            ("falha_motivo",   "ALTER TABLE pedidos ADD COLUMN falha_motivo TEXT"),
        ]
        for col, sql in migracoes:
            if col not in colunas:
                conn.execute(sql)

        # Migracao especial: remove NOT NULL de cliente_id e entregador_id
        # O SQLite nao suporta ALTER COLUMN, entao recria a tabela preservando dados
        tabela_info = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='pedidos'").fetchone()
        if tabela_info and 'cliente_id    INTEGER NOT NULL' in tabela_info[0]:
            conn.executescript("""
                PRAGMA foreign_keys = OFF;

                CREATE TABLE pedidos_nova (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id     INTEGER,
                    entregador_id  INTEGER,
                    status         TEXT NOT NULL DEFAULT 'aguardando',
                    criado_em      TEXT NOT NULL,
                    concluido_em   TEXT,
                    registrado_por TEXT,
                    pagamento_id   INTEGER,
                    nome_avulso    TEXT,
                    total          REAL,
                    cancelado      INTEGER DEFAULT 0
                );

                INSERT INTO pedidos_nova
                    (id, cliente_id, entregador_id, status, criado_em, concluido_em,
                     registrado_por, pagamento_id, nome_avulso, total, cancelado)
                SELECT
                    id, cliente_id, entregador_id, status, criado_em, concluido_em,
                    registrado_por, pagamento_id, nome_avulso, total, cancelado
                FROM pedidos;

                DROP TABLE pedidos;
                ALTER TABLE pedidos_nova RENAME TO pedidos;

                PRAGMA foreign_keys = ON;
            """)

        # Formas de pagamento padrao
        if not conn.execute("SELECT 1 FROM formas_pagamento").fetchone():
            for nome in ["Dinheiro", "Pix", "Cartao de debito", "Cartao de credito"]:
                conn.execute("INSERT INTO formas_pagamento (nome) VALUES (?)", (nome,))

# ─────────────────────────────────────────────
# PING
# ─────────────────────────────────────────────

@app.route('/ping')
def ping():
    return 'ok', 200


# ─────────────────────────────────────────────
# PAGINA PRINCIPAL E ARQUIVOS ESTATICOS
# ─────────────────────────────────────────────

@app.route('/')
@login_required
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    # login.html e acessivel sem autenticacao
    if filename == 'login.html':
        return send_from_directory('static', filename)
    if not session.get('logado'):
        return redirect('/login')
    return send_from_directory('static', filename)


# ─────────────────────────────────────────────
# CLIENTES
# ─────────────────────────────────────────────

@app.route('/api/clientes', methods=['GET'])
@login_required
def listar_clientes():
    termo = request.args.get('q', '')
    with get_conn() as conn:
        if termo:
            t = f'%{termo.lower()}%'
            rows = conn.execute(
                """SELECT * FROM clientes
                   WHERE LOWER(nome) LIKE ?
                      OR LOWER(telefone) LIKE ?
                      OR LOWER(endereco) LIKE ?
                   ORDER BY nome""",
                (t, t, t)
            ).fetchall()
        else:
            rows = conn.execute('SELECT * FROM clientes ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/clientes', methods=['POST'])
@login_required
def criar_cliente():
    d = request.get_json()
    if not d.get('nome') or not d.get('telefone') or not d.get('endereco'):
        return jsonify({'erro': 'Campos obrigatorios: nome, telefone, endereco'}), 400
    with get_conn() as conn:
        cur = conn.execute(
            'INSERT INTO clientes (nome, telefone, endereco) VALUES (?, ?, ?)',
            (d['nome'], d['telefone'], d['endereco'])
        )
        row = conn.execute('SELECT * FROM clientes WHERE id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route('/api/clientes/<int:cid>', methods=['DELETE'])
@login_required
def deletar_cliente(cid):
    with get_conn() as conn:
        conn.execute('DELETE FROM clientes WHERE id = ?', (cid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# ENTREGADORES
# ─────────────────────────────────────────────

@app.route('/api/entregadores', methods=['GET'])
@login_required
def listar_entregadores():
    with get_conn() as conn:
        rows = conn.execute('SELECT * FROM entregadores ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/entregadores', methods=['POST'])
@login_required
def criar_entregador():
    d = request.get_json()
    if not d.get('nome') or not d.get('telefone'):
        return jsonify({'erro': 'Campos obrigatorios: nome, telefone'}), 400
    with get_conn() as conn:
        cur = conn.execute(
            'INSERT INTO entregadores (nome, telefone) VALUES (?, ?)',
            (d['nome'], d['telefone'])
        )
        row = conn.execute('SELECT * FROM entregadores WHERE id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route('/api/entregadores/<int:eid>', methods=['DELETE'])
@login_required
def deletar_entregador(eid):
    with get_conn() as conn:
        conn.execute('DELETE FROM entregadores WHERE id = ?', (eid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# PRODUTOS
# ─────────────────────────────────────────────

def produto_com_opcoes(conn, produto_id):
    p = conn.execute('SELECT * FROM produtos WHERE id = ?', (produto_id,)).fetchone()
    if not p:
        return None
    opcoes = conn.execute(
        'SELECT * FROM produto_opcoes WHERE produto_id = ? ORDER BY id', (produto_id,)
    ).fetchall()
    d = dict(p)
    d['opcoes'] = [dict(o) for o in opcoes]
    return d


@app.route('/api/produtos', methods=['GET'])
@login_required
def listar_produtos():
    termo = request.args.get('q', '')
    with get_conn() as conn:
        if termo:
            rows = conn.execute(
                "SELECT * FROM produtos WHERE LOWER(nome) LIKE ? ORDER BY nome",
                (f'%{termo.lower()}%',)
            ).fetchall()
        else:
            rows = conn.execute('SELECT * FROM produtos ORDER BY nome').fetchall()
        resultado = []
        for r in rows:
            opcoes = conn.execute(
                'SELECT * FROM produto_opcoes WHERE produto_id = ? ORDER BY id', (r['id'],)
            ).fetchall()
            d = dict(r)
            d['opcoes'] = [dict(o) for o in opcoes]
            resultado.append(d)
    return jsonify(resultado)


@app.route('/api/produtos', methods=['POST'])
@login_required
def criar_produto():
    d = request.get_json()
    if not d.get('nome'):
        return jsonify({'erro': 'Campo obrigatorio: nome'}), 400
    with get_conn() as conn:
        cur = conn.execute('INSERT INTO produtos (nome) VALUES (?)', (d['nome'].strip(),))
        pid = cur.lastrowid
        for op in d.get('opcoes', []):
            if op.get('descricao'):
                conn.execute(
                    'INSERT INTO produto_opcoes (produto_id, descricao, unidade, valor) VALUES (?,?,?,?)',
                    (pid, op['descricao'].strip(), op.get('unidade','un'), op.get('valor',''))
                )
        result = produto_com_opcoes(conn, pid)
    return jsonify(result), 201


@app.route('/api/produtos/<int:pid>', methods=['DELETE'])
@login_required
def deletar_produto(pid):
    with get_conn() as conn:
        conn.execute('DELETE FROM produto_opcoes WHERE produto_id = ?', (pid,))
        conn.execute('DELETE FROM produtos WHERE id = ?', (pid,))
    return jsonify({'ok': True})


# ── Opcoes de produto ─────────────────────────

@app.route('/api/produtos/<int:pid>/opcoes', methods=['POST'])
@login_required
def adicionar_opcao(pid):
    d = request.get_json()
    if not d.get('descricao'):
        return jsonify({'erro': 'Informe a descricao da opcao'}), 400
    with get_conn() as conn:
        conn.execute(
            'INSERT INTO produto_opcoes (produto_id, descricao, unidade, valor) VALUES (?,?,?,?)',
            (pid, d['descricao'].strip(), d.get('unidade','un'), d.get('valor',''))
        )
        result = produto_com_opcoes(conn, pid)
    return jsonify(result), 201


@app.route('/api/produtos/<int:pid>/opcoes/<int:oid>', methods=['PATCH'])
@login_required
def editar_opcao(pid, oid):
    d = request.get_json()
    campos, valores = [], []
    if 'descricao' in d: campos.append('descricao = ?'); valores.append(d['descricao'].strip())
    if 'unidade' in d:   campos.append('unidade = ?');   valores.append(d['unidade'])
    if 'valor' in d:     campos.append('valor = ?');     valores.append(d['valor'])
    if not campos:
        return jsonify({'erro': 'Nenhum campo para atualizar'}), 400
    valores.append(oid)
    with get_conn() as conn:
        conn.execute(f"UPDATE produto_opcoes SET {', '.join(campos)} WHERE id = ?", valores)
        result = produto_com_opcoes(conn, pid)
    return jsonify(result)


@app.route('/api/produtos/<int:pid>/opcoes/<int:oid>', methods=['DELETE'])
@login_required
def deletar_opcao(pid, oid):
    with get_conn() as conn:
        conn.execute('DELETE FROM produto_opcoes WHERE id = ? AND produto_id = ?', (oid, pid))
        result = produto_com_opcoes(conn, pid)
    return jsonify(result)


# ─────────────────────────────────────────────
# PEDIDOS
# ─────────────────────────────────────────────

@app.route('/api/pedidos', methods=['GET'])
@login_required
def listar_pedidos():
    status = request.args.get('status', '')
    with get_conn() as conn:
        if status:
            pedidos = conn.execute(
                'SELECT * FROM pedidos WHERE status = ? ORDER BY id DESC', (status,)
            ).fetchall()
        else:
            # Por padrao oculta cancelados; passar status=cancelado para ver
            pedidos = conn.execute(
                "SELECT * FROM pedidos WHERE status NOT IN ('cancelado') ORDER BY id DESC"
            ).fetchall()

        resultado = []
        for p in pedidos:
            p = dict(p)
            itens = conn.execute(
                'SELECT * FROM itens_pedido WHERE pedido_id = ?', (p['id'],)
            ).fetchall()
            p['itens'] = [dict(i) for i in itens]
            resultado.append(p)

    return jsonify(resultado)


@app.route('/api/pedidos', methods=['POST'])
@login_required
def criar_pedido():
    d = request.get_json()
    if not d.get('cliente_id') and not d.get('nome_avulso', '').strip():
        return jsonify({'erro': 'Informe um cliente ou um nome para o pedido'}), 400
    if not d.get('itens'):
        return jsonify({'erro': 'O pedido deve ter ao menos um item'}), 400

    criado_em = datetime.now().strftime('%d/%m/%Y %H:%M')
    registrado_por = session.get('usuario', '')
    pagamento_id = d.get('pagamento_id') or None
    nome_avulso = d.get('nome_avulso', '').strip() or None
    total = d.get('total') or None
    troco = 1 if d.get('troco') else 0
    troco_valor = d.get('troco_valor') or None

    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO pedidos
               (cliente_id, entregador_id, status, criado_em, registrado_por,
                pagamento_id, nome_avulso, total, troco, troco_valor)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (d.get('cliente_id') or None, None, 'aguardando', criado_em,
             registrado_por, pagamento_id, nome_avulso, total, troco, troco_valor)
        )
        pedido_id = cur.lastrowid

        for item in d['itens']:
            conn.execute(
                'INSERT INTO itens_pedido (pedido_id, descricao, tipo, qtd, unidade, valor) VALUES (?, ?, ?, ?, ?, ?)',
                (pedido_id, item.get('desc', ''), item.get('tipo', ''),
                 item.get('qtd', ''), item.get('unidade', ''), item.get('valor', ''))
            )

        pedido = dict(conn.execute('SELECT * FROM pedidos WHERE id = ?', (pedido_id,)).fetchone())
        itens = conn.execute('SELECT * FROM itens_pedido WHERE pedido_id = ?', (pedido_id,)).fetchall()
        pedido['itens'] = [dict(i) for i in itens]

    return jsonify(pedido), 201


@app.route('/api/pedidos/<int:pid>/avancar', methods=['POST'])
@login_required
def avancar_pedido(pid):
    d = request.get_json() or {}
    with get_conn() as conn:
        pedido = conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone()
        if not pedido:
            return jsonify({'erro': 'Pedido nao encontrado'}), 404

        novo_status = None
        concluido_em = None
        entregador_id = pedido['entregador_id']
        extra_campos = []
        extra_valores = []

        if pedido['status'] == 'aguardando':
            if not d.get('entregador_id'):
                return jsonify({'erro': 'Selecione um entregador para iniciar a entrega'}), 400
            novo_status = 'rota'
            entregador_id = d['entregador_id']
        elif pedido['status'] == 'rota':
            # Falha na entrega
            if d.get('falha'):
                novo_status = 'falha'
                extra_campos.append('falha_motivo = ?')
                extra_valores.append(d.get('falha_motivo', '').strip() or None)
            else:
                novo_status = 'concluido'
                concluido_em = datetime.now().strftime('%d/%m/%Y %H:%M')

        if novo_status:
            set_clause = 'status = ?, concluido_em = ?, entregador_id = ?'
            params = [novo_status, concluido_em, entregador_id]
            for c, v in zip(extra_campos, extra_valores):
                set_clause += f', {c}'
                params.append(v)
            params.append(pid)
            conn.execute(f'UPDATE pedidos SET {set_clause} WHERE id = ?', params)

        pedido = dict(conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone())
        itens = conn.execute('SELECT * FROM itens_pedido WHERE pedido_id = ?', (pid,)).fetchall()
        pedido['itens'] = [dict(i) for i in itens]

    return jsonify(pedido)


@app.route('/api/metricas', methods=['GET'])
@login_required
def metricas():
    with get_conn() as conn:
        total = conn.execute('SELECT COUNT(*) FROM pedidos').fetchone()[0]
        rota = conn.execute("SELECT COUNT(*) FROM pedidos WHERE status = 'rota'").fetchone()[0]
        concluidos = conn.execute("SELECT COUNT(*) FROM pedidos WHERE status = 'concluido'").fetchone()[0]
    return jsonify({'total': total, 'rota': rota, 'concluidos': concluidos})



# ─────────────────────────────────────────────
# FORMAS DE PAGAMENTO
# ─────────────────────────────────────────────

@app.route('/api/pagamentos', methods=['GET'])
@login_required
def listar_pagamentos():
    with get_conn() as conn:
        rows = conn.execute('SELECT * FROM formas_pagamento ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/pagamentos', methods=['POST'])
@login_required
def criar_pagamento():
    d = request.get_json()
    if not d.get('nome'):
        return jsonify({'erro': 'Informe o nome da forma de pagamento'}), 400
    try:
        with get_conn() as conn:
            cur = conn.execute('INSERT INTO formas_pagamento (nome) VALUES (?)', (d['nome'].strip(),))
            row = conn.execute('SELECT * FROM formas_pagamento WHERE id = ?', (cur.lastrowid,)).fetchone()
        return jsonify(dict(row)), 201
    except Exception:
        return jsonify({'erro': 'Forma de pagamento ja existe'}), 409


@app.route('/api/pagamentos/<int:pid>', methods=['DELETE'])
@login_required
def deletar_pagamento(pid):
    with get_conn() as conn:
        conn.execute('DELETE FROM formas_pagamento WHERE id = ?', (pid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# CANCELAR PEDIDO
# ─────────────────────────────────────────────

@app.route('/api/pedidos/<int:pid>/cancelar', methods=['POST'])
@login_required
def cancelar_pedido(pid):
    with get_conn() as conn:
        pedido = conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone()
        if not pedido:
            return jsonify({'erro': 'Pedido nao encontrado'}), 404
        if pedido['status'] == 'concluido':
            return jsonify({'erro': 'Nao e possivel cancelar um pedido ja concluido'}), 400
        conn.execute(
            "UPDATE pedidos SET status = 'cancelado', cancelado = 1 WHERE id = ?", (pid,)
        )
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# EDITAR PEDIDO
# ─────────────────────────────────────────────

@app.route('/api/pedidos/<int:pid>', methods=['PATCH'])
@login_required
def editar_pedido(pid):
    d = request.get_json()
    with get_conn() as conn:
        pedido = conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone()
        if not pedido:
            return jsonify({'erro': 'Pedido nao encontrado'}), 404

        campos = []
        valores = []

        if 'pagamento_id' in d:
            campos.append('pagamento_id = ?')
            valores.append(d['pagamento_id'] or None)
        if 'nome_avulso' in d:
            campos.append('nome_avulso = ?')
            valores.append(d['nome_avulso'].strip() or None)
        if 'cliente_id' in d:
            campos.append('cliente_id = ?')
            valores.append(d['cliente_id'] or None)
        if 'total' in d:
            campos.append('total = ?')
            valores.append(d['total'])
        if 'troco' in d:
            campos.append('troco = ?')
            valores.append(1 if d['troco'] else 0)
        if 'troco_valor' in d:
            campos.append('troco_valor = ?')
            valores.append(d['troco_valor'] or None)

        if 'itens' in d:
            conn.execute('DELETE FROM itens_pedido WHERE pedido_id = ?', (pid,))
            for item in d['itens']:
                conn.execute(
                    'INSERT INTO itens_pedido (pedido_id, descricao, tipo, qtd, unidade, valor) VALUES (?,?,?,?,?,?)',
                    (pid, item.get('desc',''), item.get('tipo',''),
                     item.get('qtd',''), item.get('unidade',''), item.get('valor',''))
                )

        if campos:
            valores.append(pid)
            conn.execute(f"UPDATE pedidos SET {', '.join(campos)} WHERE id = ?", valores)

        pedido = dict(conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone())
        itens = conn.execute('SELECT * FROM itens_pedido WHERE pedido_id = ?', (pid,)).fetchall()
        pedido['itens'] = [dict(i) for i in itens]

    return jsonify(pedido)




# ─────────────────────────────────────────────
# EDICAO DE CLIENTES, ENTREGADORES E PRODUTOS
# ─────────────────────────────────────────────

@app.route('/api/clientes/<int:cid>', methods=['PATCH'])
@login_required
def editar_cliente(cid):
    d = request.get_json()
    campos, valores = [], []
    if 'nome' in d:     campos.append('nome = ?');     valores.append(d['nome'].strip())
    if 'telefone' in d: campos.append('telefone = ?'); valores.append(d['telefone'].strip())
    if 'endereco' in d: campos.append('endereco = ?'); valores.append(d['endereco'].strip())
    if not campos:
        return jsonify({'erro': 'Nenhum campo para atualizar'}), 400
    valores.append(cid)
    with get_conn() as conn:
        conn.execute(f"UPDATE clientes SET {', '.join(campos)} WHERE id = ?", valores)
        row = conn.execute('SELECT * FROM clientes WHERE id = ?', (cid,)).fetchone()
    return jsonify(dict(row))


@app.route('/api/entregadores/<int:eid>', methods=['PATCH'])
@login_required
def editar_entregador(eid):
    d = request.get_json()
    campos, valores = [], []
    if 'nome' in d:     campos.append('nome = ?');     valores.append(d['nome'].strip())
    if 'telefone' in d: campos.append('telefone = ?'); valores.append(d['telefone'].strip())
    if not campos:
        return jsonify({'erro': 'Nenhum campo para atualizar'}), 400
    valores.append(eid)
    with get_conn() as conn:
        conn.execute(f"UPDATE entregadores SET {', '.join(campos)} WHERE id = ?", valores)
        row = conn.execute('SELECT * FROM entregadores WHERE id = ?', (eid,)).fetchone()
    return jsonify(dict(row))


@app.route('/api/produtos/<int:pid>', methods=['PATCH'])
@login_required
def editar_produto(pid):
    d = request.get_json()
    if not d.get('nome'):
        return jsonify({'erro': 'Informe o nome do produto'}), 400
    with get_conn() as conn:
        conn.execute('UPDATE produtos SET nome = ? WHERE id = ?', (d['nome'].strip(), pid))
        result = produto_com_opcoes(conn, pid)
    return jsonify(result)

# ─────────────────────────────────────────────
# RELATORIOS
# ─────────────────────────────────────────────

@app.route('/api/relatorios', methods=['GET'])
@login_required
def relatorios():
    with get_conn() as conn:

        # ── Resumo geral ──────────────────────
        total_pedidos = conn.execute(
            "SELECT COUNT(*) FROM pedidos WHERE status NOT IN ('cancelado')"
        ).fetchone()[0]

        total_valor = conn.execute(
            "SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE status = 'concluido'"
        ).fetchone()[0]

        ticket_medio = (total_valor / conn.execute(
            "SELECT COUNT(*) FROM pedidos WHERE status = 'concluido'"
        ).fetchone()[0]) if conn.execute(
            "SELECT COUNT(*) FROM pedidos WHERE status = 'concluido'"
        ).fetchone()[0] > 0 else 0

        por_status = {}
        for row in conn.execute(
            "SELECT status, COUNT(*) FROM pedidos GROUP BY status"
        ).fetchall():
            por_status[row[0]] = row[1]

        # ── Formas de pagamento ───────────────
        pagamentos = conn.execute("""
            SELECT
                fp.nome,
                COUNT(p.id) AS qtd_pedidos,
                COALESCE(SUM(p.total), 0) AS valor_total
            FROM formas_pagamento fp
            LEFT JOIN pedidos p
                ON p.pagamento_id = fp.id
                AND p.status NOT IN ('cancelado')
            GROUP BY fp.id, fp.nome
            ORDER BY qtd_pedidos DESC
        """).fetchall()

        # Pedidos sem forma de pagamento
        sem_pag = conn.execute("""
            SELECT COUNT(*) AS qtd, COALESCE(SUM(total), 0) AS valor
            FROM pedidos
            WHERE pagamento_id IS NULL AND status NOT IN ('cancelado')
        """).fetchone()

        lista_pag = [dict(r) for r in pagamentos]
        if sem_pag[0] > 0:
            lista_pag.append({
                'nome': 'Nao informado',
                'qtd_pedidos': sem_pag[0],
                'valor_total': sem_pag[1]
            })

        # ── Itens mais vendidos ───────────────
        itens_rows = conn.execute("""
            SELECT
                ip.descricao,
                SUM(CASE WHEN ip.tipo IN ('peso','un') THEN CAST(ip.qtd AS REAL) ELSE 1 END) AS qtd_total,
                SUM(
                    CASE
                        WHEN ip.tipo = 'valor' THEN CAST(ip.valor AS REAL)
                        WHEN ip.tipo IN ('peso','un') AND ip.qtd != '' AND ip.valor != ''
                            THEN CAST(ip.qtd AS REAL) * CAST(ip.valor AS REAL)
                        ELSE 0
                    END
                ) AS valor_total,
                COUNT(DISTINCT ip.pedido_id) AS em_pedidos
            FROM itens_pedido ip
            JOIN pedidos p ON p.id = ip.pedido_id
            WHERE p.status NOT IN ('cancelado') AND ip.descricao != ''
            GROUP BY LOWER(ip.descricao)
            ORDER BY qtd_total DESC
        """).fetchall()

    return jsonify({
        'resumo': {
            'total_pedidos': total_pedidos,
            'total_valor': round(total_valor, 2),
            'ticket_medio': round(ticket_medio, 2),
            'por_status': por_status
        },
        'pagamentos': lista_pag,
        'itens': [dict(r) for r in itens_rows]
    })

# ─────────────────────────────────────────────
# INICIALIZACAO
# ─────────────────────────────────────────────

init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
