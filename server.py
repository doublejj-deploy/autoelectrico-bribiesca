#!/usr/bin/env python3
"""
SERVIDOR CENTRALIZADO - SERVICIO AUTOELÉCTRICO BRIBIESCA (v2.1 ULTRA-PERSISTENCE)
Soporte Híbrido: PostgreSQL (Render / Supabase / Neon) + SQLite Local de Contingencia
Garantía de Persistencia: Doble escritura, auto-recuperación, auto-migración y fallback automático.
"""

import http.server
import socketserver
import json
import sqlite3
import os
import sys
import urllib.parse
import mimetypes
import socket
import traceback

PORT = int(os.environ.get('PORT', 3000))
DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
DATA_DIR = os.environ.get('DATA_DIR', os.path.dirname(os.path.abspath(__file__)))
LOCAL_DB_FILE = os.path.join(DATA_DIR, 'taller_bribiesca.db')


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def safe_float(val, default=0.0):
    if val is None or val == '':
        return default
    try:
        if isinstance(val, str):
            val = val.strip().replace(',', '')
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    if val is None or val == '':
        return default
    try:
        if isinstance(val, str):
            val = val.strip().replace(',', '')
        return int(float(val))
    except (ValueError, TypeError):
        return default


def safe_str(val, default=''):
    if val is None:
        return default
    return str(val).strip()


# ==============================================================================
# GESTOR DE BASE DE DATOS ULTRA-PERSISTENTE (POSTGRESQL + SQLITE DOBLE ESCRITURA)
# ==============================================================================

class DatabaseManager:
    def __init__(self, db_url=None, sqlite_path=None):
        self.db_url = db_url or DATABASE_URL
        self.sqlite_path = sqlite_path or LOCAL_DB_FILE
        self.is_postgres = bool(self.db_url and ('postgres://' in self.db_url or 'postgresql://' in self.db_url))
        self.db_type = 'PostgreSQL' if self.is_postgres else 'SQLite'
        self.pg_driver = None
        self.pg_healthy = False

        if self.is_postgres:
            try:
                import psycopg2
                import psycopg2.extras
                self.pg_driver = 'psycopg2'
            except ImportError:
                try:
                    import pg8000.dbapi
                    self.pg_driver = 'pg8000'
                except ImportError:
                    print("⚠️ Drivers de PostgreSQL no encontrados. Operando con SQLite local.")
                    self.is_postgres = False
                    self.db_type = 'SQLite'

    def _get_sqlite_connection(self):
        conn = sqlite3.connect(self.sqlite_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.execute("PRAGMA busy_timeout = 30000;")
        except Exception:
            pass
        return conn

    def _get_postgres_connection(self):
        if not self.is_postgres or not self.db_url:
            raise RuntimeError("PostgreSQL no configurado")

        url_str = self.db_url.replace('postgres://', 'postgresql://', 1)
        parsed = urllib.parse.urlparse(url_str)
        is_internal_render = bool(
            parsed.hostname and (
                'dpg-' in parsed.hostname or
                'internal' in parsed.hostname or
                parsed.hostname.startswith('10.') or
                parsed.hostname.startswith('172.')
            ) and (not parsed.hostname.endswith('.render.com') or '-a' in parsed.hostname)
        )

        if self.pg_driver == 'psycopg2':
            import psycopg2
            # Render internal network does not use SSL; external databases require/prefer SSL
            modes_to_try = ['disable', 'prefer'] if is_internal_render else ['prefer', 'require', 'disable']
            last_err = None
            for mode in modes_to_try:
                try:
                    conn = psycopg2.connect(url_str, sslmode=mode, connect_timeout=10)
                    return conn
                except Exception as e:
                    last_err = e
            raise last_err

        elif self.pg_driver == 'pg8000':
            import pg8000.dbapi
            user = parsed.username
            password = urllib.parse.unquote(parsed.password or '')
            host = parsed.hostname
            port = parsed.port or 5432
            database = parsed.path.lstrip('/')

            ssl_contexts_to_try = [None, True] if is_internal_render else [True, None]
            last_err = None
            for s_ctx in ssl_contexts_to_try:
                try:
                    conn = pg8000.dbapi.connect(
                        user=user,
                        password=password,
                        host=host,
                        port=port,
                        database=database,
                        ssl_context=s_ctx,
                        timeout=10
                    )
                    return conn
                except Exception as e:
                    last_err = e
            raise last_err

        raise RuntimeError("No hay driver PostgreSQL disponible")

    def execute(self, sql, params=None):
        """
        Ejecuta la sentencia SQL garantizando persistencia:
        1. Escribe en PostgreSQL si está configurado.
        2. Siempre escribe simultáneamente en SQLite local como respaldo inmediato.
        """
        pg_executed = False

        if self.is_postgres:
            try:
                pg_conn = self._get_postgres_connection()
                cur = pg_conn.cursor()
                pg_sql = sql.replace('?', '%s')
                if params:
                    cur.execute(pg_sql, params)
                else:
                    cur.execute(pg_sql)
                pg_conn.commit()
                pg_conn.close()
                pg_executed = True
                self.pg_healthy = True
            except Exception as e:
                self.pg_healthy = False
                print(f"⚠️ Error al escribir en PostgreSQL ({e}). Asegurando en SQLite local.")

        # Respaldo simultáneo en SQLite local
        try:
            sq_conn = self._get_sqlite_connection()
            sq_cur = sq_conn.cursor()
            if params:
                sq_cur.execute(sql, params)
            else:
                sq_cur.execute(sql)
            sq_conn.commit()
            sq_conn.close()
        except Exception as e:
            print(f"⚠️ Error al escribir en SQLite local: {e}")
            if not pg_executed:
                raise e

    def fetch_all(self, sql, params=None):
        """Lee desde PostgreSQL si está saludable; si no, lee desde SQLite local sin interrupciones."""
        if self.is_postgres and self.pg_healthy:
            try:
                pg_conn = self._get_postgres_connection()
                cur = pg_conn.cursor()
                pg_sql = sql.replace('?', '%s')
                if params:
                    cur.execute(pg_sql, params)
                else:
                    cur.execute(pg_sql)
                if cur.description:
                    col_names = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    res = [dict(zip(col_names, row)) for row in rows]
                else:
                    res = []
                pg_conn.close()
                return res
            except Exception as e:
                print(f"⚠️ Error al consultar PostgreSQL ({e}). Consultando SQLite local.")
                self.pg_healthy = False

        # Lectura de SQLite
        sq_conn = self._get_sqlite_connection()
        sq_cur = sq_conn.cursor()
        try:
            if params:
                rows = sq_cur.execute(sql, params).fetchall()
            else:
                rows = sq_cur.execute(sql).fetchall()
            return [dict(r) for r in rows]
        finally:
            sq_conn.close()

    def fetch_one(self, sql, params=None):
        """Lee un registro individual con fallback transparente."""
        if self.is_postgres and self.pg_healthy:
            try:
                pg_conn = self._get_postgres_connection()
                cur = pg_conn.cursor()
                pg_sql = sql.replace('?', '%s')
                if params:
                    cur.execute(pg_sql, params)
                else:
                    cur.execute(pg_sql)
                row = cur.fetchone()
                if row and cur.description:
                    col_names = [desc[0] for desc in cur.description]
                    res = dict(zip(col_names, row))
                else:
                    res = None
                pg_conn.close()
                return res
            except Exception as e:
                print(f"⚠️ Error al consultar PostgreSQL ({e}). Consultando SQLite.")
                self.pg_healthy = False

        # Lectura de SQLite
        sq_conn = self._get_sqlite_connection()
        sq_cur = sq_conn.cursor()
        try:
            if params:
                row = sq_cur.execute(sql, params).fetchone()
            else:
                row = sq_cur.execute(sql).fetchone()
            return dict(row) if row else None
        finally:
            sq_conn.close()

    def init_schema(self):
        """Inicializa esquemas en SQLite y PostgreSQL."""
        schema_statements = [
            """CREATE TABLE IF NOT EXISTS clientes (
                id_cliente TEXT PRIMARY KEY,
                nombre_completo TEXT NOT NULL,
                telefono TEXT,
                email TEXT,
                direccion TEXT,
                rfc_facturacion TEXT,
                fecha_registro TEXT,
                notas TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS vehiculos (
                id_vehiculo TEXT PRIMARY KEY,
                id_cliente TEXT,
                marca TEXT,
                modelo TEXT,
                anio INTEGER,
                placa TEXT,
                color TEXT,
                numero_serie_vin TEXT,
                kilometraje_actual REAL,
                tipo_combustible TEXT,
                foto_vehiculo TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS tecnicos (
                id_tecnico TEXT PRIMARY KEY,
                nombre_tecnico TEXT NOT NULL,
                telefono TEXT,
                especialidad TEXT,
                email TEXT,
                estado_activo TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS servicios_catalogo (
                id_servicio TEXT PRIMARY KEY,
                categoria TEXT,
                nombre_servicio TEXT NOT NULL,
                descripcion TEXT,
                precio_sugerido REAL,
                tiempo_estimado_min INTEGER,
                activo TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS inventario_refacciones (
                id_refaccion TEXT PRIMARY KEY,
                categoria TEXT,
                nombre_pieza TEXT NOT NULL,
                marca TEXT,
                stock_actual REAL,
                stock_minimo REAL,
                precio_costo REAL,
                precio_venta REAL,
                ubicacion_almacen TEXT,
                foto_pieza TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS ordenes_trabajo (
                id_orden TEXT PRIMARY KEY,
                id_vehiculo TEXT,
                id_tecnico TEXT,
                fecha_ingreso TEXT,
                fecha_entrega_estimada TEXT,
                fecha_entrega_real TEXT,
                estado TEXT,
                prioridad TEXT,
                kilometraje_ingreso REAL,
                nivel_combustible TEXT,
                voltaje_bateria_v REAL,
                voltaje_alternador_v REAL,
                estado_marcha TEXT,
                codigos_falla_obd2 TEXT,
                falla_reportada TEXT,
                diagnostico_tecnico TEXT,
                trabajo_realizado TEXT,
                total_mano_obra REAL,
                total_refacciones REAL,
                subtotal REAL,
                descuento REAL,
                total_general REAL,
                anticipo REAL,
                saldo_pendiente REAL,
                metodo_pago TEXT,
                estado_pago TEXT,
                foto_entrada_frente TEXT,
                foto_tablero_testigos TEXT,
                firma_cliente_ingreso TEXT,
                firma_cliente_entrega TEXT,
                notas_internas TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS detalle_servicios (
                id_detalle_servicio TEXT PRIMARY KEY,
                id_orden TEXT,
                id_servicio TEXT,
                notas_servicio TEXT,
                costo REAL
            )""",
            """CREATE TABLE IF NOT EXISTS detalle_refacciones (
                id_detalle_refaccion TEXT PRIMARY KEY,
                id_orden TEXT,
                id_refaccion TEXT,
                cantidad REAL,
                precio_unitario REAL,
                subtotal REAL
            )""",
            """CREATE TABLE IF NOT EXISTS configuracion_taller (
                id_config TEXT PRIMARY KEY,
                nombre_taller TEXT,
                eslogan TEXT,
                telefono_principal TEXT,
                whatsapp_notificaciones TEXT,
                email_contacto TEXT,
                direccion_taller TEXT,
                horario_atencion TEXT,
                logo_url TEXT,
                terminos_garantia TEXT
            )"""
        ]

        # 1. Inicializar SQLite
        try:
            sq_conn = self._get_sqlite_connection()
            sq_cur = sq_conn.cursor()
            for stmt in schema_statements:
                sq_cur.execute(stmt)
            sq_conn.commit()
            sq_conn.close()
            print("✅ Esquema SQLite inicializado correctamente.")
        except Exception as e:
            print(f"❌ Error al inicializar esquema SQLite: {e}")

        # 2. Inicializar PostgreSQL si está disponible
        if self.is_postgres:
            try:
                pg_conn = self._get_postgres_connection()
                pg_cur = pg_conn.cursor()
                for stmt in schema_statements:
                    pg_cur.execute(stmt)
                pg_conn.commit()
                pg_conn.close()
                self.pg_healthy = True
                print("✅ Esquema PostgreSQL inicializado y sincronizado en la Nube.")
            except Exception as e:
                self.pg_healthy = False
                print(f"⚠️ No se pudo inicializar esquema PostgreSQL ({e}). Operando con SQLite.")

        # 3. Sembrar datos si la base está vacía
        self.seed_if_empty()

    def seed_if_empty(self):
        try:
            row = self.fetch_one("SELECT COUNT(*) AS count FROM clientes")
            count = row.get('count', 0) if row else 0
            if count > 0:
                return

            print("🌱 Base de datos vacía detectada. Sembrando datos iniciales...")

            # 1. Si existe archivo local SQLite previo con datos, importar a PostgreSQL
            if self.is_postgres and self.pg_healthy and os.path.exists(self.sqlite_path):
                try:
                    local_conn = sqlite3.connect(self.sqlite_path)
                    local_conn.row_factory = sqlite3.Row
                    local_cur = local_conn.cursor()
                    tables = ['clientes', 'vehiculos', 'tecnicos', 'servicios_catalogo',
                              'inventario_refacciones', 'ordenes_trabajo', 'detalle_servicios',
                              'detalle_refacciones', 'configuracion_taller']
                    migrated = False
                    for tbl in tables:
                        rows = local_cur.execute(f"SELECT * FROM {tbl}").fetchall()
                        if rows:
                            migrated = True
                            for r in rows:
                                self._insert_generic_dict(tbl, dict(r))
                    local_conn.close()
                    if migrated:
                        print("✨ Migración exitosa de SQLite local hacia PostgreSQL.")
                        return
                except Exception as e:
                    print(f"Aviso al migrar de SQLite a PostgreSQL: {e}")

            # 2. Cargar desde data.js
            data_js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')
            if os.path.exists(data_js_path):
                with open(data_js_path, 'r', encoding='utf-8') as f:
                    text = f.read()
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end != -1:
                    initial_data = json.loads(text[start:end])
                    self.sync_full_state(initial_data)
                    print("✅ Datos semilla cargados exitosamente desde data.js")
        except Exception as e:
            print(f"Aviso en seed_if_empty: {e}")

    def _insert_generic_dict(self, table_name, data_dict):
        cols = list(data_dict.keys())
        if not cols:
            return
        placeholders = ', '.join(['?'] * len(cols))
        col_names = ', '.join(cols)
        pk = cols[0]
        pk_val = data_dict[pk]

        existing = self.fetch_one(f"SELECT 1 FROM {table_name} WHERE {pk} = ?", (pk_val,))
        if existing:
            update_clauses = ', '.join([f"{c} = ?" for c in cols if c != pk])
            update_params = [data_dict[c] for c in cols if c != pk] + [pk_val]
            self.execute(f"UPDATE {table_name} SET {update_clauses} WHERE {pk} = ?", update_params)
        else:
            insert_params = [data_dict[c] for c in cols]
            self.execute(f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})", insert_params)

    def sync_full_state(self, state):
        """Inserta o actualiza un estado completo en la base de datos."""
        for c in state.get('Clientes', []):
            self.upsert_client(c)

        for v in state.get('Vehiculos', []):
            self.upsert_vehicle(v)

        for t in state.get('Tecnicos', []):
            self.upsert_technician(t)

        for s in state.get('Servicios_Catalogo', []):
            self.upsert_service(s)

        for r in state.get('Inventario_Refacciones', []):
            self.upsert_part(r)

        for o in state.get('Ordenes_Trabajo', []):
            self.upsert_order(o)

    def upsert_client(self, data):
        cid = safe_str(data.get('ID_Cliente') or data.get('id_cliente'))
        if not cid:
            count_row = self.fetch_one("SELECT COUNT(*) AS c FROM clientes")
            cnt = (count_row.get('c') if count_row else 0) + 1
            cid = f"CLI-{str(cnt).zfill(3)}"

        nombre = safe_str(data.get('Nombre_Completo') or data.get('nombre_completo'), 'Cliente General')
        telefono = safe_str(data.get('Telefono') or data.get('telefono'))
        email = safe_str(data.get('Email') or data.get('email'))
        direccion = safe_str(data.get('Direccion') or data.get('direccion'))
        rfc = safe_str(data.get('RFC_Facturacion') or data.get('rfc_facturacion'))
        fecha = safe_str(data.get('Fecha_Registro') or data.get('fecha_registro'))
        notas = safe_str(data.get('Notas') or data.get('notas'))

        params = (nombre, telefono, email, direccion, rfc, fecha, notas, cid)
        existing = self.fetch_one("SELECT 1 FROM clientes WHERE id_cliente = ?", (cid,))
        if existing:
            self.execute("""UPDATE clientes SET
                nombre_completo = ?, telefono = ?, email = ?, direccion = ?,
                rfc_facturacion = ?, fecha_registro = ?, notas = ?
                WHERE id_cliente = ?""", params)
        else:
            self.execute("""INSERT INTO clientes (
                nombre_completo, telefono, email, direccion,
                rfc_facturacion, fecha_registro, notas, id_cliente
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", params)
        return cid

    def upsert_vehicle(self, data):
        vid = safe_str(data.get('ID_Vehiculo') or data.get('id_vehiculo'))
        if not vid:
            count_row = self.fetch_one("SELECT COUNT(*) AS c FROM vehiculos")
            cnt = (count_row.get('c') if count_row else 0) + 1
            vid = f"VEH-{str(cnt).zfill(3)}"

        placa = safe_str(data.get('Placa') or data.get('placa')).upper()
        if not placa:
            placa = f"SIN-PLACA-{vid}"

        params = (
            safe_str(data.get('ID_Cliente') or data.get('id_cliente')),
            safe_str(data.get('Marca') or data.get('marca'), 'Generico'),
            safe_str(data.get('Modelo') or data.get('modelo'), 'Unidad'),
            safe_int(data.get('Anio') or data.get('anio'), 2020),
            placa,
            safe_str(data.get('Color') or data.get('color')),
            safe_str(data.get('Numero_Serie_VIN') or data.get('numero_serie_vin')),
            safe_float(data.get('Kilometraje_Actual') or data.get('kilometraje_actual'), 0),
            safe_str(data.get('Tipo_Combustible') or data.get('tipo_combustible'), 'Gasolina'),
            safe_str(data.get('Foto_Vehiculo') or data.get('foto_vehiculo')),
            vid
        )

        existing = self.fetch_one("SELECT 1 FROM vehiculos WHERE id_vehiculo = ?", (vid,))
        if existing:
            self.execute("""UPDATE vehiculos SET
                id_cliente = ?, marca = ?, modelo = ?, anio = ?, placa = ?,
                color = ?, numero_serie_vin = ?, kilometraje_actual = ?,
                tipo_combustible = ?, foto_vehiculo = ?
                WHERE id_vehiculo = ?""", params)
        else:
            self.execute("""INSERT INTO vehiculos (
                id_cliente, marca, modelo, anio, placa,
                color, numero_serie_vin, kilometraje_actual,
                tipo_combustible, foto_vehiculo, id_vehiculo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", params)
        return vid

    def upsert_technician(self, data):
        tid = safe_str(data.get('ID_Tecnico') or data.get('id_tecnico'))
        if not tid:
            tid = 'TEC-001'

        params = (
            safe_str(data.get('Nombre_Tecnico') or data.get('nombre_tecnico'), 'Técnico'),
            safe_str(data.get('Telefono') or data.get('telefono')),
            safe_str(data.get('Especialidad') or data.get('especialidad'), 'Electromecánico'),
            safe_str(data.get('Email') or data.get('email')),
            safe_str(data.get('Estado_Activo') or data.get('estado_activo'), 'Activo'),
            tid
        )
        existing = self.fetch_one("SELECT 1 FROM tecnicos WHERE id_tecnico = ?", (tid,))
        if existing:
            self.execute("UPDATE tecnicos SET nombre_tecnico = ?, telefono = ?, especialidad = ?, email = ?, estado_activo = ? WHERE id_tecnico = ?", params)
        else:
            self.execute("INSERT INTO tecnicos (nombre_tecnico, telefono, especialidad, email, estado_activo, id_tecnico) VALUES (?, ?, ?, ?, ?, ?)", params)
        return tid

    def upsert_service(self, data):
        sid = safe_str(data.get('ID_Servicio') or data.get('id_servicio'))
        if not sid:
            count_row = self.fetch_one("SELECT COUNT(*) AS c FROM servicios_catalogo")
            cnt = (count_row.get('c') if count_row else 0) + 1
            sid = f"SRV-{str(cnt).zfill(3)}"

        params = (
            safe_str(data.get('Categoria') or data.get('categoria'), 'General'),
            safe_str(data.get('Nombre_Servicio') or data.get('nombre_servicio'), 'Servicio General'),
            safe_str(data.get('Descripcion') or data.get('descripcion')),
            safe_float(data.get('Precio_Sugerido') or data.get('precio_sugerido'), 0),
            safe_int(data.get('Tiempo_Estimado_Min') or data.get('tiempo_estimado_min'), 60),
            safe_str(data.get('Activo') or data.get('activo'), 'Sí'),
            sid
        )
        existing = self.fetch_one("SELECT 1 FROM servicios_catalogo WHERE id_servicio = ?", (sid,))
        if existing:
            self.execute("""UPDATE servicios_catalogo SET
                categoria = ?, nombre_servicio = ?, descripcion = ?,
                precio_sugerido = ?, tiempo_estimado_min = ?, activo = ?
                WHERE id_servicio = ?""", params)
        else:
            self.execute("""INSERT INTO servicios_catalogo (
                categoria, nombre_servicio, descripcion,
                precio_sugerido, tiempo_estimado_min, activo, id_servicio
            ) VALUES (?, ?, ?, ?, ?, ?, ?)""", params)
        return sid

    def upsert_part(self, data):
        pid = safe_str(data.get('ID_Refaccion') or data.get('id_refaccion'))
        if not pid:
            count_row = self.fetch_one("SELECT COUNT(*) AS c FROM inventario_refacciones")
            cnt = (count_row.get('c') if count_row else 0) + 1
            pid = f"REF-{str(cnt).zfill(3)}"

        params = (
            safe_str(data.get('Categoria') or data.get('categoria'), 'General'),
            safe_str(data.get('Nombre_Pieza') or data.get('nombre_pieza'), 'Refacción'),
            safe_str(data.get('Marca') or data.get('marca')),
            safe_float(data.get('Stock_Actual') or data.get('stock_actual'), 0),
            safe_float(data.get('Stock_Minimo') or data.get('stock_minimo'), 2),
            safe_float(data.get('Precio_Costo') or data.get('precio_costo'), 0),
            safe_float(data.get('Precio_Venta') or data.get('precio_venta'), 0),
            safe_str(data.get('Ubicacion_Almacen') or data.get('ubicacion_almacen')),
            safe_str(data.get('Foto_Pieza') or data.get('foto_pieza')),
            pid
        )
        existing = self.fetch_one("SELECT 1 FROM inventario_refacciones WHERE id_refaccion = ?", (pid,))
        if existing:
            self.execute("""UPDATE inventario_refacciones SET
                categoria = ?, nombre_pieza = ?, marca = ?, stock_actual = ?,
                stock_minimo = ?, precio_costo = ?, precio_venta = ?,
                ubicacion_almacen = ?, foto_pieza = ?
                WHERE id_refaccion = ?""", params)
        else:
            self.execute("""INSERT INTO inventario_refacciones (
                categoria, nombre_pieza, marca, stock_actual,
                stock_minimo, precio_costo, precio_venta,
                ubicacion_almacen, foto_pieza, id_refaccion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", params)
        return pid

    def upsert_order(self, data):
        oid = safe_str(data.get('ID_Orden') or data.get('id_orden'))
        if not oid:
            count_row = self.fetch_one("SELECT COUNT(*) AS c FROM ordenes_trabajo")
            cnt = (count_row.get('c') if count_row else 0) + 1
            oid = f"ORD-{str(cnt).zfill(3)}"

        params = (
            safe_str(data.get('ID_Vehiculo') or data.get('id_vehiculo')),
            safe_str(data.get('ID_Tecnico') or data.get('id_tecnico')),
            safe_str(data.get('Fecha_Ingreso') or data.get('fecha_ingreso')),
            safe_str(data.get('Fecha_Entrega_Estimada') or data.get('fecha_entrega_estimada')),
            safe_str(data.get('Fecha_Entrega_Real') or data.get('fecha_entrega_real')),
            safe_str(data.get('Estado') or data.get('estado'), 'Recepcionado'),
            safe_str(data.get('Prioridad') or data.get('prioridad'), 'Normal'),
            safe_float(data.get('Kilometraje_Ingreso') or data.get('kilometraje_ingreso'), 0),
            safe_str(data.get('Nivel_Combustible') or data.get('nivel_combustible'), '1/2'),
            safe_float(data.get('Voltaje_Bateria_V') or data.get('voltaje_bateria_v'), 0),
            safe_float(data.get('Voltaje_Alternador_V') or data.get('voltaje_alternador_v'), 0),
            safe_str(data.get('Estado_Marcha') or data.get('estado_marcha'), 'Normal'),
            safe_str(data.get('Codigos_Falla_OBD2') or data.get('codigos_falla_obd2')),
            safe_str(data.get('Falla_Reportada') or data.get('falla_reportada')),
            safe_str(data.get('Diagnostico_Tecnico') or data.get('diagnostico_tecnico')),
            safe_str(data.get('Trabajo_Realizado') or data.get('trabajo_realizado')),
            safe_float(data.get('Total_Mano_Obra') or data.get('total_mano_obra'), 0),
            safe_float(data.get('Total_Refacciones') or data.get('total_refacciones'), 0),
            safe_float(data.get('Subtotal') or data.get('subtotal'), 0),
            safe_float(data.get('Descuento') or data.get('descuento'), 0),
            safe_float(data.get('Total_General') or data.get('total_general'), 0),
            safe_float(data.get('Anticipo') or data.get('anticipo'), 0),
            safe_float(data.get('Saldo_Pendiente') or data.get('saldo_pendiente'), 0),
            safe_str(data.get('Metodo_Pago') or data.get('metodo_pago'), 'Efectivo'),
            safe_str(data.get('Estado_Pago') or data.get('estado_pago'), 'Pendiente'),
            safe_str(data.get('Foto_Entrada_Frente') or data.get('foto_entrada_frente')),
            safe_str(data.get('Foto_Tablero_Testigos') or data.get('foto_tablero_testigos')),
            safe_str(data.get('Firma_Cliente_Ingreso') or data.get('firma_cliente_ingreso')),
            safe_str(data.get('Firma_Cliente_Entrega') or data.get('firma_cliente_entrega')),
            safe_str(data.get('Notas_Internas') or data.get('notas_internas')),
            oid
        )

        existing = self.fetch_one("SELECT 1 FROM ordenes_trabajo WHERE id_orden = ?", (oid,))
        if existing:
            self.execute("""UPDATE ordenes_trabajo SET
                id_vehiculo = ?, id_tecnico = ?, fecha_ingreso = ?, fecha_entrega_estimada = ?,
                fecha_entrega_real = ?, estado = ?, prioridad = ?, kilometraje_ingreso = ?,
                nivel_combustible = ?, voltaje_bateria_v = ?, voltaje_alternador_v = ?,
                estado_marcha = ?, codigos_falla_obd2 = ?, falla_reportada = ?,
                diagnostico_tecnico = ?, trabajo_realizado = ?, total_mano_obra = ?,
                total_refacciones = ?, subtotal = ?, descuento = ?, total_general = ?,
                anticipo = ?, saldo_pendiente = ?, metodo_pago = ?, estado_pago = ?,
                foto_entrada_frente = ?, foto_tablero_testigos = ?, firma_cliente_ingreso = ?,
                firma_cliente_entrega = ?, notas_internas = ?
                WHERE id_orden = ?""", params)
        else:
            self.execute("""INSERT INTO ordenes_trabajo (
                id_vehiculo, id_tecnico, fecha_ingreso, fecha_entrega_estimada,
                fecha_entrega_real, estado, prioridad, kilometraje_ingreso,
                nivel_combustible, voltaje_bateria_v, voltaje_alternador_v,
                estado_marcha, codigos_falla_obd2, falla_reportada,
                diagnostico_tecnico, trabajo_realizado, total_mano_obra,
                total_refacciones, subtotal, descuento, total_general,
                anticipo, saldo_pendiente, metodo_pago, estado_pago,
                foto_entrada_frente, foto_tablero_testigos, firma_cliente_ingreso,
                firma_cliente_entrega, notas_internas, id_orden
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", params)
        return oid

    def delete_order(self, oid):
        self.execute("DELETE FROM ordenes_trabajo WHERE id_orden = ?", (oid,))
        self.execute("DELETE FROM detalle_servicios WHERE id_orden = ?", (oid,))
        self.execute("DELETE FROM detalle_refacciones WHERE id_orden = ?", (oid,))
        return True


# Instancia Global
db_manager = DatabaseManager()


# ==============================================================================
# MANEJADOR HTTP API REST Y ARCHIVOS ESTÁTICOS
# ==============================================================================

class CentralDatabaseHandler(http.server.BaseHTTPRequestHandler):

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status_code=200):
        try:
            payload = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8')
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            print(f"Error enviando respuesta JSON: {e}")

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw = self.rfile.read(content_length)
            try:
                return json.loads(raw.decode('utf-8'))
            except Exception as e:
                print(f"Error decodificando cuerpo JSON: {e}")
                return {}
        return {}

    # === RUTAS GET ===
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'

        if path == '/api/status':
            try:
                orders_count = (db_manager.fetch_one("SELECT COUNT(*) AS c FROM ordenes_trabajo") or {}).get('c', 0)
                clients_count = (db_manager.fetch_one("SELECT COUNT(*) AS c FROM clientes") or {}).get('c', 0)
                parts_count = (db_manager.fetch_one("SELECT COUNT(*) AS c FROM inventario_refacciones") or {}).get('c', 0)
                vehicles_count = (db_manager.fetch_one("SELECT COUNT(*) AS c FROM vehiculos") or {}).get('c', 0)

                active_engine = "PostgreSQL (Nube Render)" if (db_manager.is_postgres and db_manager.pg_healthy) else (
                    "SQLite Local (Respaldo en Contingencia)" if db_manager.is_postgres else "SQLite Local Persistente"
                )

                self.send_json({
                    'status': 'online',
                    'database_type': db_manager.db_type,
                    'active_engine': active_engine,
                    'pg_healthy': db_manager.pg_healthy,
                    'is_persistent': True,
                    'dual_write_enabled': True,
                    'counts': {
                        'orders': orders_count,
                        'clients': clients_count,
                        'vehicles': vehicles_count,
                        'parts': parts_count
                    },
                    'local_ip': get_local_ip(),
                    'port': PORT,
                    'version': '2.1-ultra-persistence'
                })
            except Exception as e:
                self.send_json({'status': 'error', 'error': str(e)}, 500)
            return

        if path == '/api/all':
            self.handle_get_all_data()
            return

        if path == '/api/sync-excel':
            self.handle_sync_to_excel()
            return

        # Servir archivos estáticos
        self.serve_static_file(parsed.path)

    # === RUTAS POST ===
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        body = self.read_json_body()

        if path == '/api/orders':
            self.handle_save_order(body)
            return

        if path == '/api/clients':
            self.handle_create_client_and_vehicle(body)
            return

        if path == '/api/parts':
            self.handle_create_part(body)
            return

        if path.startswith('/api/parts/') and path.endswith('/adjust-stock'):
            parts = path.split('/')
            part_id = parts[3]
            self.handle_adjust_stock(part_id, body)
            return

        if path == '/api/services':
            self.handle_create_service(body)
            return

        if path == '/api/sync-all':
            self.handle_sync_all(body)
            return

        self.send_json({'error': 'Endpoint POST no encontrado'}, 404)

    # === RUTAS PUT ===
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        body = self.read_json_body()

        if path.startswith('/api/orders/'):
            order_id = path.split('/')[3]
            body['ID_Orden'] = order_id
            self.handle_save_order(body)
            return

        self.send_json({'error': 'Endpoint PUT no encontrado'}, 404)

    # === RUTAS DELETE ===
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'

        if path.startswith('/api/orders/'):
            order_id = path.split('/')[3]
            try:
                db_manager.delete_order(order_id)
                self.send_json({'success': True, 'id_orden': order_id, 'message': 'Orden eliminada de base de datos'})
            except Exception as e:
                self.send_json({'success': False, 'error': str(e)}, 500)
            return

        self.send_json({'error': 'Endpoint DELETE no encontrado'}, 404)

    # ==========================================================================
    # MANEJADORES DE OPERACIONES API
    # ==========================================================================

    def handle_get_all_data(self):
        try:
            clientes_raw = db_manager.fetch_all("SELECT * FROM clientes")
            vehiculos_raw = db_manager.fetch_all("SELECT * FROM vehiculos")
            tecnicos_raw = db_manager.fetch_all("SELECT * FROM tecnicos")
            servicios_raw = db_manager.fetch_all("SELECT * FROM servicios_catalogo")
            refacciones_raw = db_manager.fetch_all("SELECT * FROM inventario_refacciones")
            ordenes_raw = db_manager.fetch_all("SELECT * FROM ordenes_trabajo")
            det_servicios_raw = db_manager.fetch_all("SELECT * FROM detalle_servicios")
            det_refacciones_raw = db_manager.fetch_all("SELECT * FROM detalle_refacciones")
            config_raw = db_manager.fetch_all("SELECT * FROM configuracion_taller")

            # Mapeo universal a CamelCase
            clientes = [{
                'ID_Cliente': r.get('id_cliente'),
                'Nombre_Completo': r.get('nombre_completo'),
                'Telefono': r.get('telefono'),
                'Email': r.get('email'),
                'Direccion': r.get('direccion'),
                'RFC_Facturacion': r.get('rfc_facturacion'),
                'Fecha_Registro': r.get('fecha_registro'),
                'Notas': r.get('notas')
            } for r in clientes_raw]

            vehiculos = [{
                'ID_Vehiculo': r.get('id_vehiculo'),
                'ID_Cliente': r.get('id_cliente'),
                'Marca': r.get('marca'),
                'Modelo': r.get('modelo'),
                'Anio': r.get('anio'),
                'Placa': r.get('placa'),
                'Color': r.get('color'),
                'Numero_Serie_VIN': r.get('numero_serie_vin'),
                'Kilometraje_Actual': r.get('kilometraje_actual'),
                'Tipo_Combustible': r.get('tipo_combustible'),
                'Foto_Vehiculo': r.get('foto_vehiculo')
            } for r in vehiculos_raw]

            tecnicos = [{
                'ID_Tecnico': r.get('id_tecnico'),
                'Nombre_Tecnico': r.get('nombre_tecnico'),
                'Telefono': r.get('telefono'),
                'Especialidad': r.get('especialidad'),
                'Email': r.get('email'),
                'Estado_Activo': r.get('estado_activo')
            } for r in tecnicos_raw]

            servicios = [{
                'ID_Servicio': r.get('id_servicio'),
                'Categoria': r.get('categoria'),
                'Nombre_Servicio': r.get('nombre_servicio'),
                'Descripcion': r.get('descripcion'),
                'Precio_Sugerido': r.get('precio_sugerido'),
                'Tiempo_Estimado_Min': r.get('tiempo_estimado_min'),
                'Activo': r.get('activo')
            } for r in servicios_raw]

            refacciones = [{
                'ID_Refaccion': r.get('id_refaccion'),
                'Categoria': r.get('categoria'),
                'Nombre_Pieza': r.get('nombre_pieza'),
                'Marca': r.get('marca'),
                'Stock_Actual': r.get('stock_actual'),
                'Stock_Minimo': r.get('stock_minimo'),
                'Precio_Costo': r.get('precio_costo'),
                'Precio_Venta': r.get('precio_venta'),
                'Ubicacion_Almacen': r.get('ubicacion_almacen'),
                'Foto_Pieza': r.get('foto_pieza')
            } for r in refacciones_raw]

            ordenes = [{
                'ID_Orden': r.get('id_orden'),
                'ID_Vehiculo': r.get('id_vehiculo'),
                'ID_Tecnico': r.get('id_tecnico'),
                'Fecha_Ingreso': r.get('fecha_ingreso'),
                'Fecha_Entrega_Estimada': r.get('fecha_entrega_estimada'),
                'Fecha_Entrega_Real': r.get('fecha_entrega_real'),
                'Estado': r.get('estado'),
                'Prioridad': r.get('prioridad'),
                'Kilometraje_Ingreso': r.get('kilometraje_ingreso'),
                'Nivel_Combustible': r.get('nivel_combustible'),
                'Voltaje_Bateria_V': r.get('voltaje_bateria_v'),
                'Voltaje_Alternador_V': r.get('voltaje_alternador_v'),
                'Estado_Marcha': r.get('estado_marcha'),
                'Codigos_Falla_OBD2': r.get('codigos_falla_obd2'),
                'Falla_Reportada': r.get('falla_reportada'),
                'Diagnostico_Tecnico': r.get('diagnostico_tecnico'),
                'Trabajo_Realizado': r.get('trabajo_realizado'),
                'Total_Mano_Obra': r.get('total_mano_obra'),
                'Total_Refacciones': r.get('total_refacciones'),
                'Subtotal': r.get('subtotal'),
                'Descuento': r.get('descuento'),
                'Total_General': r.get('total_general'),
                'Anticipo': r.get('anticipo'),
                'Saldo_Pendiente': r.get('saldo_pendiente'),
                'Metodo_Pago': r.get('metodo_pago'),
                'Estado_Pago': r.get('estado_pago'),
                'Foto_Entrada_Frente': r.get('foto_entrada_frente'),
                'Foto_Tablero_Testigos': r.get('foto_tablero_testigos'),
                'Firma_Cliente_Ingreso': r.get('firma_cliente_ingreso'),
                'Firma_Cliente_Entrega': r.get('firma_cliente_entrega'),
                'Notas_Internas': r.get('notas_internas')
            } for r in ordenes_raw]

            self.send_json({
                'Clientes': clientes,
                'Vehiculos': vehiculos,
                'Tecnicos': tecnicos,
                'Servicios_Catalogo': servicios,
                'Inventario_Refacciones': refacciones,
                'Ordenes_Trabajo': ordenes,
                'Detalle_Servicios': det_servicios_raw,
                'Detalle_Refacciones': det_refacciones_raw,
                'Configuracion_Taller': config_raw
            })
        except Exception as e:
            traceback.print_exc()
            self.send_json({'error': str(e)}, 500)

    def handle_save_order(self, data):
        try:
            order_id = db_manager.upsert_order(data)
            self.send_json({
                'success': True,
                'id_orden': order_id,
                'message': f'Orden persistida correctamente en base de datos ({db_manager.db_type})'
            })
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_create_client_and_vehicle(self, data):
        try:
            cli_id = db_manager.upsert_client(data)
            veh_data = dict(data)
            veh_data['ID_Cliente'] = cli_id
            veh_id = db_manager.upsert_vehicle(veh_data)
            self.send_json({
                'success': True,
                'id_cliente': cli_id,
                'id_vehiculo': veh_id,
                'message': f'Cliente y vehículo guardados en BD ({db_manager.db_type})'
            })
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_create_part(self, data):
        try:
            part_id = db_manager.upsert_part(data)
            self.send_json({'success': True, 'id_refaccion': part_id})
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_adjust_stock(self, part_id, data):
        try:
            delta = safe_int(data.get('delta', 0))
            row = db_manager.fetch_one("SELECT stock_actual, nombre_pieza FROM inventario_refacciones WHERE id_refaccion = ?", (part_id,))
            if not row:
                self.send_json({'error': 'Pieza no encontrada'}, 404)
                return

            current_stock = safe_float(row.get('stock_actual'), 0)
            new_stock = max(0, current_stock + delta)
            db_manager.execute("UPDATE inventario_refacciones SET stock_actual = ? WHERE id_refaccion = ?", (new_stock, part_id))

            self.send_json({
                'success': True,
                'id_refaccion': part_id,
                'nombre_pieza': row.get('nombre_pieza'),
                'stock_actual': new_stock
            })
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_create_service(self, data):
        try:
            srv_id = db_manager.upsert_service(data)
            self.send_json({'success': True, 'id_servicio': srv_id})
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_sync_all(self, data):
        """Sincroniza un estado completo enviado desde el cliente (auto-hidratación o respaldo)."""
        try:
            db_manager.sync_full_state(data)
            orders_c = len(data.get('Ordenes_Trabajo', []))
            clients_c = len(data.get('Clientes', []))
            self.send_json({
                'success': True,
                'message': 'Estado completo sincronizado y persistido permanentemente en Base de Datos',
                'orders_synced': orders_c,
                'clients_synced': clients_c
            })
        except Exception as e:
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)}, 500)

    def handle_sync_to_excel(self):
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            wb.remove(wb.active)

            table_sheets = [
                ('clientes', 'Clientes'),
                ('vehiculos', 'Vehiculos'),
                ('tecnicos', 'Tecnicos'),
                ('servicios_catalogo', 'Servicios_Catalogo'),
                ('inventario_refacciones', 'Inventario_Refacciones'),
                ('ordenes_trabajo', 'Ordenes_Trabajo'),
                ('detalle_servicios', 'Detalle_Servicios'),
                ('detalle_refacciones', 'Detalle_Refacciones'),
                ('configuracion_taller', 'Configuracion_Taller')
            ]

            for tbl, sheet_title in table_sheets:
                rows = db_manager.fetch_all(f"SELECT * FROM {tbl}")
                ws = wb.create_sheet(sheet_title)
                if rows:
                    ws.append(list(rows[0].keys()))
                    for r in rows:
                        ws.append(list(r.values()))

            excel_path = os.path.join(DATA_DIR, 'Servicio_Autoelectrico_Bribiesca_PRO.xlsx')
            wb.save(excel_path)
            self.send_json({'success': True, 'message': 'Excel exportado correctamente', 'path': excel_path})
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)

    # === SERVIR ARCHIVOS ESTÁTICOS ===
    def serve_static_file(self, raw_path):
        clean_path = urllib.parse.unquote(raw_path).lstrip('/')
        if clean_path == '' or clean_path == '/':
            clean_path = 'index.html'

        base_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(base_dir, clean_path)

        if not os.path.commonprefix([os.path.abspath(full_path), base_dir]).startswith(base_dir):
            self.send_error(403, "Acceso prohibido")
            return

        if os.path.exists(full_path) and os.path.isfile(full_path):
            mime_type, _ = mimetypes.guess_type(full_path)
            if not mime_type:
                if full_path.endswith('.js'): mime_type = 'application/javascript'
                elif full_path.endswith('.css'): mime_type = 'text/css'
                elif full_path.endswith('.html'): mime_type = 'text/html; charset=utf-8'
                elif full_path.endswith('.json'): mime_type = 'application/json'
                else: mime_type = 'application/octet-stream'

            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(os.path.getsize(full_path)))
            self.send_cors_headers()
            self.end_headers()

            with open(full_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "Archivo no encontrado")


# ==============================================================================
# INICIALIZACIÓN DEL SERVIDOR
# ==============================================================================

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("=" * 72)
    print("⚡ SERVIDOR CENTRALIZADO - SERVICIO AUTOELÉCTRICO BRIBIESCA (v2.1 ULTRA)")
    print(f"🗄️  Motor de Base de Datos Configurado: {db_manager.db_type}")
    if db_manager.is_postgres:
        print(f"🌐 Nube: PostgreSQL detectado ({db_manager.pg_driver})")
    print(f"📁 SQLite Local de Respaldo: {LOCAL_DB_FILE}")
    print(f"🖥️  Acceso Local: http://localhost:{PORT}")
    print(f"📱 Red Taller / Dispositivos: http://{local_ip}:{PORT}")
    print("=" * 72)

    # Inicializar tablas y datos
    db_manager.init_schema()

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), CentralDatabaseHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido correctamente.")
            sys.exit(0)
