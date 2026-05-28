from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "it_support.db"

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def rows_to_dicts(rows):
    return [dict(row) for row in rows]


def init_db():
    conn = connect_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS support_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER,
            type TEXT DEFAULT 'category',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            image_url TEXT,
            icon TEXT,
            color TEXT DEFAULT '#dc2626',
            sort_order INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            problem TEXT DEFAULT '',
            solution TEXT DEFAULT '',
            image TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS article_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            step_order INTEGER NOT NULL,
            step_title TEXT DEFAULT '',
            step_detail TEXT DEFAULT '',
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT DEFAULT '',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)", ("admin", "admin123"))

    default_settings = {
        "site_name": "IT Support Center",
        "system_version": "1.0",
        "display_note": ""
    }
    for key, value in default_settings.items():
        cur.execute("""
            INSERT OR IGNORE INTO system_settings (setting_key, setting_value)
            VALUES (?, ?)
        """, (key, value))

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return app.send_static_file("index.html")


@app.route("/admin/<path:filename>")
def admin_page(filename):
    return app.send_static_file(f"admin/{filename}")


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    conn = connect_db()
    admin = conn.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
    conn.close()

    if not admin:
        return jsonify(success=False, message="ไม่พบผู้ใช้นี้")
    if password != admin["password"]:
        return jsonify(success=False, message="รหัสผ่านไม่ถูกต้อง")
    return jsonify(success=True, message="เข้าสู่ระบบสำเร็จ")


@app.route("/api/logout", methods=["POST", "GET"])
def logout():
    return jsonify(success=True, message="ออกจากระบบสำเร็จ")

@app.route("/api/admin_check", methods=["GET"])
def admin_check():
    return jsonify(success=True)

@app.route("/api/get_nodes", methods=["GET"])
@app.route("/api/support_nodes_list", methods=["GET"])
def get_nodes():
    conn = connect_db()
    rows = conn.execute("SELECT * FROM support_nodes ORDER BY sort_order ASC, id ASC").fetchall()
    conn.close()
    return jsonify(success=True, data=rows_to_dicts(rows))


def get_articles_with_steps(order_sql="ORDER BY id DESC"):
    conn = connect_db()
    articles = rows_to_dicts(conn.execute(f"SELECT * FROM articles {order_sql}").fetchall())
    steps = rows_to_dicts(conn.execute("SELECT * FROM article_steps ORDER BY article_id ASC, step_order ASC").fetchall())
    conn.close()

    step_map = {}
    for step in steps:
        step_map.setdefault(step["article_id"], []).append(step)
    for article in articles:
        article["steps"] = step_map.get(article["id"], [])
    return articles


@app.route("/api/admin_dashboard", methods=["GET"])
def admin_dashboard():
    conn = connect_db()
    nodes = rows_to_dicts(conn.execute("SELECT * FROM support_nodes ORDER BY sort_order ASC, id ASC").fetchall())
    conn.close()
    articles = get_articles_with_steps("ORDER BY id DESC")
    return jsonify(success=True, support_nodes=nodes, articles=articles)


@app.route("/api/articles", methods=["GET"])
def articles():
    articles = get_articles_with_steps("ORDER BY category ASC, id DESC")
    return jsonify(success=True, data=articles)


@app.route("/api/article_create", methods=["POST"])
def article_create():
    data = request.get_json(silent=True) or {}
    category = (data.get("category") or "").strip()
    title = (data.get("title") or "").strip()
    problem = (data.get("problem") or "").strip()
    steps = data.get("steps") or []

    if not category or not title or not steps:
        return jsonify(success=False, message="กรุณากรอกข้อมูลให้ครบ")

    first_solution = (steps[0].get("detail") if isinstance(steps[0], dict) else "") or ""

    conn = connect_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO articles (category, title, problem, solution)
        VALUES (?, ?, ?, ?)
    """, (category, title, problem, first_solution.strip()))
    article_id = cur.lastrowid

    for index, step in enumerate(steps):
        step_title = (step.get("title") or f"STEP {index + 1}").strip()
        step_detail = (step.get("detail") or "").strip()
        if not step_detail:
            continue
        cur.execute("""
            INSERT INTO article_steps (article_id, step_order, step_title, step_detail)
            VALUES (?, ?, ?, ?)
        """, (article_id, index + 1, step_title, step_detail))

    conn.commit()
    conn.close()
    return jsonify(success=True, message="เพิ่มปัญหาสำเร็จ", id=article_id)


@app.route("/api/article_update", methods=["POST", "PUT"])
def article_update():
    data = request.get_json(silent=True) or {}
    article_id = int(data.get("id") or 0)
    category = (data.get("category") or "").strip()
    title = (data.get("title") or "").strip()
    problem = (data.get("problem") or "").strip()
    steps = data.get("steps") or []

    if article_id <= 0 or not category or not title or not steps:
        return jsonify(success=False, message="กรุณากรอกข้อมูลให้ครบ")

    first_solution = (steps[0].get("detail") if isinstance(steps[0], dict) else "") or ""

    conn = connect_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE articles
        SET category = ?, title = ?, problem = ?, solution = ?
        WHERE id = ?
    """, (category, title, problem, first_solution.strip(), article_id))
    cur.execute("DELETE FROM article_steps WHERE article_id = ?", (article_id,))

    for index, step in enumerate(steps):
        step_title = (step.get("title") or f"STEP {index + 1}").strip()
        step_detail = (step.get("detail") or "").strip()
        if not step_detail:
            continue
        cur.execute("""
            INSERT INTO article_steps (article_id, step_order, step_title, step_detail)
            VALUES (?, ?, ?, ?)
        """, (article_id, index + 1, step_title, step_detail))

    conn.commit()
    conn.close()
    return jsonify(success=True, message="แก้ไขปัญหาสำเร็จ")


@app.route("/api/article_delete", methods=["POST", "DELETE"])
def article_delete():
    data = request.get_json(silent=True) or {}
    article_id = int(data.get("id") or 0)
    if article_id <= 0:
        return jsonify(success=False, message="ไม่พบ ID")

    conn = connect_db()
    conn.execute("DELETE FROM article_steps WHERE article_id = ?", (article_id,))
    conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="ลบสำเร็จ")


@app.route("/api/support_node_create", methods=["POST"])
def support_node_create():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    color = data.get("color") or "#dc2626"
    sort_order = int(data.get("sort_order") or 0)
    node_type = data.get("type") or "category"
    parent_id = data.get("parent_id")

    if not title:
        return jsonify(success=False, message="กรุณากรอกชื่อหัวข้อ")

    conn = connect_db()
    cur = conn.cursor()
    exists = cur.execute("SELECT id FROM support_nodes WHERE type = ? AND title = ? LIMIT 1", (node_type, title)).fetchone()
    if exists:
        conn.close()
        return jsonify(success=False, message="มีหัวข้อนี้อยู่แล้ว")

    if sort_order <= 0:
        row = cur.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM support_nodes WHERE type = ?", (node_type,)).fetchone()
        sort_order = int(row["next_order"])

    cur.execute("""
        INSERT INTO support_nodes (parent_id, type, title, description, color, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (parent_id, node_type, title, description, color, sort_order))
    node_id = cur.lastrowid
    conn.commit()
    conn.close()
    return jsonify(success=True, message="เพิ่มข้อมูลสำเร็จ", id=node_id, sort_order=sort_order)


@app.route("/api/support_node_update", methods=["POST", "PUT"])
def support_node_update():
    data = request.get_json(silent=True) or {}
    node_id = int(data.get("id") or 0)
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    color = data.get("color") or "#dc2626"
    sort_order = int(data.get("sort_order") or 0)

    if node_id <= 0:
        return jsonify(success=False, message="ไม่พบ ID")
    if not title:
        return jsonify(success=False, message="กรุณากรอกชื่อหัวข้อ")

    conn = connect_db()
    conn.execute("""
        UPDATE support_nodes
        SET title = ?, description = ?, color = ?, sort_order = ?
        WHERE id = ?
    """, (title, description, color, sort_order, node_id))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="แก้ไขสำเร็จ")


@app.route("/api/support_node_delete", methods=["POST", "DELETE"])
def support_node_delete():
    data = request.get_json(silent=True) or {}
    node_id = int(data.get("id") or 0)
    if node_id <= 0:
        return jsonify(success=False, message="ไม่พบ ID")

    conn = connect_db()
    conn.execute("DELETE FROM support_nodes WHERE id = ?", (node_id,))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="ลบข้อมูลสำเร็จ")


@app.route("/api/settings_get", methods=["GET"])
def settings_get():
    conn = connect_db()
    rows = conn.execute("SELECT setting_key, setting_value FROM system_settings").fetchall()
    conn.close()
    settings = {row["setting_key"]: row["setting_value"] for row in rows}
    return jsonify(success=True, settings=settings)


@app.route("/api/settings_update", methods=["POST", "PUT"])
def settings_update():
    data = request.get_json(silent=True) or {}
    site_name = (data.get("site_name") or "").strip()
    system_version = (data.get("system_version") or "").strip()
    display_note = (data.get("display_note") or "").strip()

    if not site_name or not system_version:
        return jsonify(success=False, message="กรุณากรอกชื่อระบบและเวอร์ชัน")

    conn = connect_db()
    for key, value in {
        "site_name": site_name,
        "system_version": system_version,
        "display_note": display_note,
    }.items():
        conn.execute("""
            INSERT INTO system_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP
        """, (key, value))
    conn.commit()
    conn.close()
    return jsonify(success=True, message="บันทึกการตั้งค่าสำเร็จ")


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000)