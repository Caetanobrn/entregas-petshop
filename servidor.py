"""
servidor.py - Backend Flask com SQLite para o sistema de entregas Pet Shop
Railway: define a variavel de ambiente PORT automaticamente
"""

import sqlite3
import os
from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime

app = Flask(__name__, static_folder='static')

# No Railway o banco fica em /data (volume persistente) se configurado,
# caso contrario fica na pasta do projeto (resetaria em cada deploy).
# Para persistencia real no Railway, usamos um volume montado em /data.
DATA_DIR = os.environ.get('DATA_DIR', '.')
DB_PATH = os.path.join(DATA_DIR, 'petshop.db')


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
                cliente_id    INTEGER NOT NULL,
                entregador_id INTEGER NOT NULL,
                status        TEXT NOT NULL DEFAULT 'aguardando',
                criado_em     TEXT NOT NULL,
                concluido_em  TEXT,
                FOREIGN KEY (cliente_id)    REFERENCES clientes(id),
                FOREIGN KEY (entregador_id) REFERENCES entregadores(id)
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
        """)


# ─────────────────────────────────────────────
# PING (evita o servidor dormir no plano gratuito)
# ─────────────────────────────────────────────

@app.route('/ping')
def ping():
    return 'ok', 200


# ─────────────────────────────────────────────
# PAGINA PRINCIPAL
# ─────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


# ─────────────────────────────────────────────
# CLIENTES
# ─────────────────────────────────────────────

@app.route('/api/clientes', methods=['GET'])
def listar_clientes():
    with get_conn() as conn:
        rows = conn.execute('SELECT * FROM clientes ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/clientes', methods=['POST'])
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
def deletar_cliente(cid):
    with get_conn() as conn:
        conn.execute('DELETE FROM clientes WHERE id = ?', (cid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# ENTREGADORES
# ─────────────────────────────────────────────

@app.route('/api/entregadores', methods=['GET'])
def listar_entregadores():
    with get_conn() as conn:
        rows = conn.execute('SELECT * FROM entregadores ORDER BY nome').fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/entregadores', methods=['POST'])
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
def deletar_entregador(eid):
    with get_conn() as conn:
        conn.execute('DELETE FROM entregadores WHERE id = ?', (eid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# PRODUTOS
# ─────────────────────────────────────────────

@app.route('/api/produtos', methods=['GET'])
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
    return jsonify([dict(r) for r in rows])


@app.route('/api/produtos', methods=['POST'])
def criar_produto():
    d = request.get_json()
    if not d.get('nome'):
        return jsonify({'erro': 'Campo obrigatorio: nome'}), 400
    with get_conn() as conn:
        cur = conn.execute(
            'INSERT INTO produtos (nome, unidade, valor) VALUES (?, ?, ?)',
            (d['nome'], d.get('unidade', 'un'), d.get('valor', ''))
        )
        row = conn.execute('SELECT * FROM produtos WHERE id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route('/api/produtos/<int:pid>', methods=['DELETE'])
def deletar_produto(pid):
    with get_conn() as conn:
        conn.execute('DELETE FROM produtos WHERE id = ?', (pid,))
    return jsonify({'ok': True})


# ─────────────────────────────────────────────
# PEDIDOS
# ─────────────────────────────────────────────

@app.route('/api/pedidos', methods=['GET'])
def listar_pedidos():
    status = request.args.get('status', '')
    with get_conn() as conn:
        if status:
            pedidos = conn.execute(
                'SELECT * FROM pedidos WHERE status = ? ORDER BY id DESC', (status,)
            ).fetchall()
        else:
            pedidos = conn.execute('SELECT * FROM pedidos ORDER BY id DESC').fetchall()

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
def criar_pedido():
    d = request.get_json()
    if not d.get('cliente_id') or not d.get('entregador_id'):
        return jsonify({'erro': 'Campos obrigatorios: cliente_id, entregador_id'}), 400
    if not d.get('itens'):
        return jsonify({'erro': 'O pedido deve ter ao menos um item'}), 400

    criado_em = datetime.now().strftime('%d/%m/%Y %H:%M')

    with get_conn() as conn:
        cur = conn.execute(
            'INSERT INTO pedidos (cliente_id, entregador_id, status, criado_em) VALUES (?, ?, ?, ?)',
            (d['cliente_id'], d['entregador_id'], 'aguardando', criado_em)
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
def avancar_pedido(pid):
    with get_conn() as conn:
        pedido = conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone()
        if not pedido:
            return jsonify({'erro': 'Pedido nao encontrado'}), 404

        novo_status = None
        concluido_em = None
        if pedido['status'] == 'aguardando':
            novo_status = 'rota'
        elif pedido['status'] == 'rota':
            novo_status = 'concluido'
            concluido_em = datetime.now().strftime('%d/%m/%Y %H:%M')

        if novo_status:
            conn.execute(
                'UPDATE pedidos SET status = ?, concluido_em = ? WHERE id = ?',
                (novo_status, concluido_em, pid)
            )

        pedido = dict(conn.execute('SELECT * FROM pedidos WHERE id = ?', (pid,)).fetchone())
        itens = conn.execute('SELECT * FROM itens_pedido WHERE pedido_id = ?', (pid,)).fetchall()
        pedido['itens'] = [dict(i) for i in itens]

    return jsonify(pedido)


@app.route('/api/metricas', methods=['GET'])
def metricas():
    with get_conn() as conn:
        total = conn.execute('SELECT COUNT(*) FROM pedidos').fetchone()[0]
        rota = conn.execute("SELECT COUNT(*) FROM pedidos WHERE status = 'rota'").fetchone()[0]
        concluidos = conn.execute("SELECT COUNT(*) FROM pedidos WHERE status = 'concluido'").fetchone()[0]
    return jsonify({'total': total, 'rota': rota, 'concluidos': concluidos})


# ─────────────────────────────────────────────
# INICIALIZACAO
# ─────────────────────────────────────────────

init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
