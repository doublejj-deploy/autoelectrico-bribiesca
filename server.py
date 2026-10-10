#!/usr/bin/env python3
"""
SERVIDOR CENTRALIZADO - SERVICIO AUTOELÉCTRICO BRIBIESCA
Backend HTTP + API REST conectado a Base de Datos SQLite (taller_bribiesca.db)
"""

import http.server
import socketserver
import json
import sqlite3
import os
import urllib.parse
import mimetypes
import socket

PORT = int(os.environ.get('PORT', 3000))
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'taller_bribiesca.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

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
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API Endpoints
        if path == '/api/status':
            self.send_json({
                'status': 'online',
                'database': 'SQLite',
                'db_file': DB_FILE,
                'local_ip': get_local_ip(),
                'port': PORT
            })
            return

        if path == '/api/all':
            self.handle_get_all_data()
            return

        if path == '/api/sync-excel':
            self.handle_sync_to_excel()
            return

        # Static Files Serving
        self.serve_static_file(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
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

        self.send_json({'error': 'Endpoint no encontrado'}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path.startswith('/api/orders/'):
            order_id = path.split('/')[3]
            self.handle_update_order(order_id, body)
            return

        self.send_json({'error': 'Endpoint no encontrado'}, 404)

    def read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw = self.rfile.read(content_length)
            try:
                return json.loads(raw.decode('utf-8'))
            except Exception:
                return {}
        return {}

    # === API HANDLERS ===

    def handle_get_all_data(self):
        conn = get_db_connection()
        cur = conn.cursor()

        def fetch_table(table_name):
            rows = cur.execute(f"SELECT * FROM {table_name}").fetchall()
            return [dict(r) for r in rows]

        # Convert table names to original casing for frontend compatibility
        def format_rows(rows, column_map):
            formatted = []
            for r in rows:
                new_row = {}
                for k, v in r.items():
                    target_key = column_map.get(k.lower(), k)
                    new_row[target_key] = v
                formatted.append(new_row)
            return formatted

        clientes_raw = fetch_table('clientes')
        vehiculos_raw = fetch_table('vehiculos')
        tecnicos_raw = fetch_table('tecnicos')
        servicios_raw = fetch_table('servicios_catalogo')
        refacciones_raw = fetch_table('inventario_refacciones')
        ordenes_raw = fetch_table('ordenes_trabajo')
        det_servicios_raw = fetch_table('detalle_servicios')
        det_refacciones_raw = fetch_table('detalle_refacciones')
        config_raw = fetch_table('configuracion_taller')

        conn.close()

        # Map to original casing expected by app.js
        clientes = [{
            'ID_Cliente': r['id_cliente'],
            'Nombre_Completo': r['nombre_completo'],
            'Telefono': r['telefono'],
            'Email': r['email'],
            'Direccion': r['direccion'],
            'RFC_Facturacion': r['rfc_facturacion'],
            'Fecha_Registro': r['fecha_registro'],
            'Notas': r['notas']
        } for r in clientes_raw]

        vehiculos = [{
            'ID_Vehiculo': r['id_vehiculo'],
            'ID_Cliente': r['id_cliente'],
            'Marca': r['marca'],
            'Modelo': r['modelo'],
            'Anio': r['anio'],
            'Placa': r['placa'],
            'Color': r['color'],
            'Numero_Serie_VIN': r['numero_serie_vin'],
            'Kilometraje_Actual': r['kilometraje_actual'],
            'Tipo_Combustible': r['tipo_combustible'],
            'Foto_Vehiculo': r['foto_vehiculo']
        } for r in vehiculos_raw]

        tecnicos = [{
            'ID_Tecnico': r['id_tecnico'],
            'Nombre_Tecnico': r['nombre_tecnico'],
            'Telefono': r['telefono'],
            'Especialidad': r['especialidad'],
            'Email': r['email'],
            'Estado_Activo': r['estado_activo']
        } for r in tecnicos_raw]

        servicios = [{
            'ID_Servicio': r['id_servicio'],
            'Categoria': r['categoria'],
            'Nombre_Servicio': r['nombre_servicio'],
            'Descripcion': r['descripcion'],
            'Precio_Sugerido': r['precio_sugerido'],
            'Tiempo_Estimado_Min': r['tiempo_estimado_min'],
            'Activo': r['activo']
        } for r in servicios_raw]

        refacciones = [{
            'ID_Refaccion': r['id_refaccion'],
            'Categoria': r['categoria'],
            'Nombre_Pieza': r['nombre_pieza'],
            'Marca': r['marca'],
            'Stock_Actual': r['stock_actual'],
            'Stock_Minimo': r['stock_minimo'],
            'Precio_Costo': r['precio_costo'],
            'Precio_Venta': r['precio_venta'],
            'Ubicacion_Almacen': r['ubicacion_almacen'],
            'Foto_Pieza': r['foto_pieza']
        } for r in refacciones_raw]

        ordenes = [{
            'ID_Orden': r['id_orden'],
            'ID_Vehiculo': r['id_vehiculo'],
            'ID_Tecnico': r['id_tecnico'],
            'Fecha_Ingreso': r['fecha_ingreso'],
            'Fecha_Entrega_Estimada': r['fecha_entrega_estimada'],
            'Fecha_Entrega_Real': r['fecha_entrega_real'],
            'Estado': r['estado'],
            'Prioridad': r['prioridad'],
            'Kilometraje_Ingreso': r['kilometraje_ingreso'],
            'Nivel_Combustible': r['nivel_combustible'],
            'Voltaje_Bateria_V': r['voltaje_bateria_v'],
            'Voltaje_Alternador_V': r['voltaje_alternador_v'],
            'Estado_Marcha': r['estado_marcha'],
            'Codigos_Falla_OBD2': r['codigos_falla_obd2'],
            'Falla_Reportada': r['falla_reportada'],
            'Diagnostico_Tecnico': r['diagnostico_tecnico'],
            'Trabajo_Realizado': r['trabajo_realizado'],
            'Total_Mano_Obra': r['total_mano_obra'],
            'Total_Refacciones': r['total_refacciones'],
            'Subtotal': r['subtotal'],
            'Descuento': r['descuento'],
            'Total_General': r['total_general'],
            'Anticipo': r['anticipo'],
            'Saldo_Pendiente': r['saldo_pendiente'],
            'Metodo_Pago': r['metodo_pago'],
            'Estado_Pago': r['estado_pago'],
            'Firma_Cliente_Ingreso': r['firma_cliente_ingreso'],
            'Firma_Cliente_Entrega': r['firma_cliente_entrega'],
            'Notas_Internas': r['notas_internas']
        } for r in ordenes_raw]

        self.send_json({
            'Clientes': clientes,
            'Vehiculos': vehiculos,
            'Tecnicos': tecnicos,
            'Servicios_Catalogo': servicios,
            'Inventario_Refacciones': refacciones,
            'Ordenes_Trabajo': ordenes,
            'Detalle_Servicios': [dict(r) for r in det_servicios_raw],
            'Detalle_Refacciones': [dict(r) for r in det_refacciones_raw],
            'Configuracion_Taller': [dict(r) for r in config_raw]
        })

    def handle_save_order(self, data):
        conn = get_db_connection()
        cur = conn.cursor()

        order_id = data.get('ID_Orden')
        if not order_id:
            count = cur.execute("SELECT COUNT(*) FROM ordenes_trabajo").fetchone()[0]
            order_id = f"ORD-{str(count + 1).zfill(3)}"

        cur.execute('''
        INSERT OR REPLACE INTO ordenes_trabajo (
            id_orden, id_vehiculo, id_tecnico, fecha_ingreso, fecha_entrega_estimada,
            fecha_entrega_real, estado, prioridad, kilometraje_ingreso, nivel_combustible,
            voltaje_bateria_v, voltaje_alternador_v, estado_marcha, codigos_falla_obd2,
            falla_reportada, diagnostico_tecnico, trabajo_realizado, total_mano_obra,
            total_refacciones, subtotal, descuento, total_general, anticipo,
            saldo_pendiente, metodo_pago, estado_pago, firma_cliente_ingreso,
            firma_cliente_entrega, notas_internas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            order_id,
            data.get('ID_Vehiculo'),
            data.get('ID_Tecnico'),
            data.get('Fecha_Ingreso'),
            data.get('Fecha_Entrega_Estimada', ''),
            data.get('Fecha_Entrega_Real', ''),
            data.get('Estado', 'Recepcionado'),
            data.get('Prioridad', 'Normal'),
            data.get('Kilometraje_Ingreso', 0),
            data.get('Nivel_Combustible', '1/2'),
            data.get('Voltaje_Bateria_V', 0),
            data.get('Voltaje_Alternador_V', 0),
            data.get('Estado_Marcha', 'Normal'),
            data.get('Codigos_Falla_OBD2', ''),
            data.get('Falla_Reportada', ''),
            data.get('Diagnostico_Tecnico', ''),
            data.get('Trabajo_Realizado', ''),
            data.get('Total_Mano_Obra', 0),
            data.get('Total_Refacciones', 0),
            data.get('Subtotal', 0),
            data.get('Descuento', 0),
            data.get('Total_General', 0),
            data.get('Anticipo', 0),
            data.get('Saldo_Pendiente', 0),
            data.get('Metodo_Pago', 'Efectivo'),
            data.get('Estado_Pago', 'Pendiente'),
            data.get('Firma_Cliente_Ingreso', ''),
            data.get('Firma_Cliente_Entrega', ''),
            data.get('Notas_Internas', '')
        ))

        conn.commit()
        conn.close()
        self.send_json({'success': True, 'id_orden': order_id, 'message': 'Orden guardada en base de datos central'})

    def handle_update_order(self, order_id, data):
        data['ID_Orden'] = order_id
        self.handle_save_order(data)

    def handle_create_client_and_vehicle(self, data):
        conn = get_db_connection()
        cur = conn.cursor()

        cli_count = cur.execute("SELECT COUNT(*) FROM clientes").fetchone()[0]
        cli_id = data.get('ID_Cliente') or f"CLI-{str(cli_count + 1).zfill(3)}"

        cur.execute('''
        INSERT OR REPLACE INTO clientes (
            id_cliente, nombre_completo, telefono, email, direccion, rfc_facturacion, fecha_registro, notas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            cli_id,
            data.get('Nombre_Completo'),
            data.get('Telefono'),
            data.get('Email', ''),
            data.get('Direccion', ''),
            data.get('RFC_Facturacion', ''),
            data.get('Fecha_Registro', ''),
            data.get('Notas', '')
        ))

        # Vehicle
        veh_count = cur.execute("SELECT COUNT(*) FROM vehiculos").fetchone()[0]
        veh_id = data.get('ID_Vehiculo') or f"VEH-{str(veh_count + 1).zfill(3)}"

        cur.execute('''
        INSERT OR REPLACE INTO vehiculos (
            id_vehiculo, id_cliente, marca, modelo, anio, placa, color, numero_serie_vin, kilometraje_actual, tipo_combustible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            veh_id,
            cli_id,
            data.get('Marca', ''),
            data.get('Modelo', ''),
            data.get('Anio', 2020),
            data.get('Placa', '').upper(),
            data.get('Color', ''),
            data.get('Numero_Serie_VIN', ''),
            data.get('Kilometraje_Actual', 0),
            data.get('Tipo_Combustible', 'Gasolina')
        ))

        conn.commit()
        conn.close()
        self.send_json({'success': True, 'id_cliente': cli_id, 'id_vehiculo': veh_id})

    def handle_create_part(self, data):
        conn = get_db_connection()
        cur = conn.cursor()

        part_count = cur.execute("SELECT COUNT(*) FROM inventario_refacciones").fetchone()[0]
        part_id = data.get('ID_Refaccion') or f"REF-{str(part_count + 1).zfill(3)}"

        cur.execute('''
        INSERT OR REPLACE INTO inventario_refacciones (
            id_refaccion, categoria, nombre_pieza, marca, stock_actual, stock_minimo, precio_costo, precio_venta, ubicacion_almacen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            part_id,
            data.get('Categoria'),
            data.get('Nombre_Pieza'),
            data.get('Marca', ''),
            data.get('Stock_Actual', 0),
            data.get('Stock_Minimo', 2),
            data.get('Precio_Costo', 0),
            data.get('Precio_Venta', 0),
            data.get('Ubicacion_Almacen', '')
        ))

        conn.commit()
        conn.close()
        self.send_json({'success': True, 'id_refaccion': part_id})

    def handle_adjust_stock(self, part_id, data):
        delta = int(data.get('delta', 0))
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT stock_actual, nombre_pieza FROM inventario_refacciones WHERE id_refaccion = ?", (part_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            self.send_json({'error': 'Pieza no encontrada'}, 404)
            return

        current_stock = row['stock_actual'] or 0
        new_stock = max(0, current_stock + delta)

        cur.execute("UPDATE inventario_refacciones SET stock_actual = ? WHERE id_refaccion = ?", (new_stock, part_id))
        conn.commit()
        conn.close()

        self.send_json({
            'success': True,
            'id_refaccion': part_id,
            'nombre_pieza': row['nombre_pieza'],
            'stock_actual': new_stock
        })

    def handle_create_service(self, data):
        conn = get_db_connection()
        cur = conn.cursor()

        count = cur.execute("SELECT COUNT(*) FROM servicios_catalogo").fetchone()[0]
        srv_id = data.get('ID_Servicio') or f"SRV-{str(count + 1).zfill(3)}"

        cur.execute('''
        INSERT OR REPLACE INTO servicios_catalogo (
            id_servicio, categoria, nombre_servicio, descripcion, precio_sugerido, tiempo_estimado_min, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            srv_id,
            data.get('Categoria', 'General'),
            data.get('Nombre_Servicio'),
            data.get('Descripcion', ''),
            data.get('Precio_Sugerido', 0),
            data.get('Tiempo_Estimado_Min', 60),
            data.get('Activo', 'Sí')
        ))

        conn.commit()
        conn.close()
        self.send_json({'success': True, 'id_servicio': srv_id})

    def handle_sync_to_excel(self):
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            wb.remove(wb.active)

            conn = get_db_connection()
            cur = conn.cursor()

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
                rows = cur.execute(f"SELECT * FROM {tbl}").fetchall()
                ws = wb.create_sheet(sheet_title)
                if rows:
                    ws.append(list(rows[0].keys()))
                    for r in rows:
                        ws.append(list(r))
                else:
                    cur.execute(f"PRAGMA table_info({tbl})")
                    ws.append([col[1] for col in cur.fetchall()])

            conn.close()
            excel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Servicio_Autoelectrico_Bribiesca_PRO.xlsx')
            wb.save(excel_path)
            self.send_json({'success': True, 'message': 'Excel sincronizado desde base de datos SQLite', 'path': excel_path})
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)}, 500)

    # === STATIC FILES ===

    def serve_static_file(self, path):
        if path == '/' or path == '':
            path = '/index.html'

        base_dir = os.path.dirname(os.path.abspath(__file__))
        clean_path = urllib.parse.unquote(path).lstrip('/')
        full_path = os.path.join(base_dir, clean_path)

        # Prevent directory traversal
        if not os.path.commonprefix([os.path.abspath(full_path), base_dir]).startswith(base_dir):
            self.send_error(403, "Acceso prohibido")
            return

        if os.path.exists(full_path) and os.path.isfile(full_path):
            mime_type, _ = mimetypes.guess_type(full_path)
            if not mime_type:
                if full_path.endswith('.js'): mime_type = 'application/javascript'
                elif full_path.endswith('.css'): mime_type = 'text/css'
                elif full_path.endswith('.html'): mime_type = 'text/html; charset=utf-8'
                else: mime_type = 'application/octet-stream'

            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', os.path.getsize(full_path))
            self.send_cors_headers()
            self.end_headers()

            with open(full_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "Archivo no encontrado")


if __name__ == '__main__':
    local_ip = get_local_ip()
    print("=" * 65)
    print("⚡ SERVIDOR CENTRALIZADO - SERVICIO AUTOELÉCTRICO BRIBIESCA")
    print(f"📁 Base de Datos: {DB_FILE} (SQLite)")
    print(f"🖥️  Acceso Local: http://localhost:{PORT}")
    print(f"📱 Acceso Móvil / Red Taller: http://{local_ip}:{PORT}")
    print("=" * 65)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), CentralDatabaseHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
