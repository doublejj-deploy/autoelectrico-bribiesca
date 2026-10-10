# Guía de Implementación y Configuración en AppSheet
## Taller Servicio Autoeléctrico Bribiesca ⚡🚗

Esta guía detalla la arquitectura, fórmulas, diseño UX y permisos necesarios para poner en marcha tu aplicación profesional en Google AppSheet utilizando el nuevo archivo optimizado **[Servicio_Autoelectrico_Bribiesca_PRO.xlsx](file:///Users/usar/Documents/Servicio%20Autoelectrico%20Bribiesca/Servicio_Autoelectrico_Bribiesca_PRO.xlsx)**.

---

## 1. Paso a Paso para Crear la App en AppSheet

1. **Subir el archivo a Google Drive**:
   - Entra a [Google Drive](https://drive.google.com).
   - Sube el archivo **`Servicio_Autoelectrico_Bribiesca_PRO.xlsx`** y la imagen **`logo hugo.jpeg`** a una carpeta llamada `App_Autoelectrico_Bribiesca`.
   - *(Recomendado)* Haz clic derecho sobre el archivo en Drive > *Abrir con* > **Hojas de cálculo de Google** (para un rendimiento óptimo en AppSheet).

2. **Crear la App en AppSheet**:
   - Ve a [AppSheet.com](https://www.appsheet.com) e inicia sesión con tu cuenta de Google.
   - Haz clic en **Create** > **App** > **Start with existing data**.
   - Nombre de la app: `Servicio Autoeléctrico Bribiesca`.
   - Categoría: `Auto & Transport` o `Field Service`.
   - Selecciona el archivo de cálculo que subiste a Google Drive.

3. **Agregar las tablas**:
   - AppSheet cargará la primera tabla automáticamente.
   - Ve al menú lateral **Data** > **Add Table** y agrega el resto de las hojas:
     1. `Clientes`
     2. `Vehiculos`
     3. `Tecnicos`
     4. `Servicios_Catalogo`
     5. `Inventario_Refacciones`
     6. `Ordenes_Trabajo`
     7. `Detalle_Servicios`
     8. `Detalle_Refacciones`
     9. `Configuracion_Taller`

---

## 2. Configuración de Tablas, Columnas y Tipos de Datos

### Tabla `Clientes`
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Cliente` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `Nombre_Completo` | **Name** | **Label: Sí**. Requerido: Sí |
| `Telefono` | **Phone** | Requerido: Sí |
| `Email` | **Email** | Opcional |
| `Direccion` | **Address** | Opcional |
| `RFC_Facturacion` | **Text** | Opcional |
| `Fecha_Registro` | **Date** | Initial value: `TODAY()` |
| `Notas` | **LongText** | Opcional |

---

### Tabla `Vehiculos`
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Vehiculo` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `ID_Cliente` | **Ref** | Referenced table: `Clientes`. **IsPartOf: No** |
| `Marca` | **Text** | Requerido: Sí (Enum sugerido: Nissan, Chevrolet, Ford, Toyota, VW, etc.) |
| `Modelo` | **Text** | Requerido: Sí |
| `Anio` | **Number** | Min: 1980, Max: 2030 |
| `Placa` | **Text** | **Label: Sí**. Requerido: Sí (Mayúsculas) |
| `Color` | **Text** | Opcional |
| `Numero_Serie_VIN` | **Text** | Opcional |
| `Kilometraje_Actual`| **Number** | Opcional |
| `Tipo_Combustible` | **Enum** | Valores: `Gasolina`, `Diesel`, `Híbrido`, `Eléctrico`, `Gas LP` |
| `Foto_Vehiculo` | **Image** | Opcional |

---

### Tabla `Tecnicos`
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Tecnico` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `Nombre_Tecnico` | **Name** | **Label: Sí**. Requerido: Sí |
| `Telefono` | **Phone** | Requerido: Sí |
| `Especialidad` | **Enum** | `Diagnóstico Eléctrico`, `Alternadores y Carga`, `Marchas y Arranque`, `Cableado e Iluminación`, `General` |
| `Email` | **Email** | Utilizado para filtro de usuario (`USEREMAIL()`) |
| `Estado_Activo` | **Enum** | `Activo`, `Inactivo` |

---

### Tabla `Servicios_Catalogo`
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Servicio` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `Categoria` | **Enum** | `Diagnóstico`, `Sistema Carga`, `Sistema Arranque`, `Iluminación`, `Baterías`, `Accesorios`, `Cableado/Cortos` |
| `Nombre_Servicio` | **Text** | **Label: Sí**. Requerido: Sí |
| `Descripcion` | **LongText** | Opcional |
| `Precio_Sugerido` | **Price** | Requerido: Sí |
| `Tiempo_Estimado_Min`| **Number** | Minutos aproximados |
| `Activo` | **Yes/No** | Default: `TRUE` |

---

### Tabla `Inventario_Refacciones`
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Refaccion` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `Categoria` | **Enum** | `Baterías`, `Alternadores`, `Marchas`, `Relevadores`, `Iluminación`, `Fusibles`, `Reguladores`, `Cables y Terminales` |
| `Nombre_Pieza` | **Text** | **Label: Sí**. Requerido: Sí |
| `Marca` | **Text** | Bosch, LTH, Hella, Philips, Duralast, etc. |
| `Stock_Actual` | **Number** | Requerido: Sí |
| `Stock_Minimo` | **Number** | Requerido: Sí (Umbral de alerta) |
| `Precio_Costo` | **Price** | Visible solo para Administradores |
| `Precio_Venta` | **Price** | Requerido: Sí |
| `Ubicacion_Almacen`| **Text** | Ej: `Estante A-1`, `Gaveta B-3` |
| `Foto_Pieza` | **Image** | Opcional |
| `Alerta_Stock` *(Col. Virtual)* | **Text** | Fórmula: `IF([Stock_Actual] <= [Stock_Minimo], "🚨 REABASTECER", "✅ OK")` |

---

### Tabla `Ordenes_Trabajo` (Tabla Principal)
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Orden` | **Text** | **Key: Sí**. Initial value: `CONCATENATE("ORD-", RIGHT(UNIQUEID(), 5))` |
| `ID_Vehiculo` | **Ref** | Referenced table: `Vehiculos`. **Label: Sí** |
| `ID_Tecnico` | **Ref** | Referenced table: `Tecnicos` |
| `Fecha_Ingreso` | **DateTime** | Initial value: `NOW()` |
| `Fecha_Entrega_Estimada` | **DateTime** | Initial value: `NOW() + 1` |
| `Fecha_Entrega_Real` | **DateTime** | Opcional (se llena al entregar) |
| `Estado` | **Enum** | `Recepcionado`, `En Diagnóstico`, `Presupuesto Pendiente`, `Aprobado por Cliente`, `En Reparación`, `Pruebas de Calidad`, `Listo para Entrega`, `Entregado`, `Cancelado` |
| `Prioridad` | **Enum** | `Baja`, `Normal`, `Alta`, `Urgente` |
| `Kilometraje_Ingreso` | **Number** | Initial value: `[ID_Vehiculo].[Kilometraje_Actual]` |
| `Nivel_Combustible` | **Enum** | `Reserva`, `1/4`, `1/2`, `3/4`, `Lleno` |
| `Voltaje_Bateria_V` | **Decimal** | Medición de multímetro en reposo (ej: 12.6) |
| `Voltaje_Alternador_V`| **Decimal** | Medición con motor encendido (ej: 14.2) |
| `Estado_Marcha` | **Enum** | `Arranca normal`, `Arranca lento / pesado`, `Hace clic y no gira`, `Bendix patina`, `No da marcha` |
| `Codigos_Falla_OBD2` | **Text** | Códigos leídos con escáner (ej: P0562, P0615) |
| `Falla_Reportada` | **LongText** | Lo que el cliente describe |
| `Diagnostico_Tecnico` | **LongText** | Evaluación del técnico |
| `Trabajo_Realizado` | **LongText** | Resumen final de la reparación |
| `Total_Mano_Obra` *(Virtual)* | **Price** | Fórmula: `SUM([Related Detalle_Servicios][Costo])` |
| `Total_Refacciones` *(Virtual)* | **Price** | Fórmula: `SUM([Related Detalle_Refacciones][Subtotal])` |
| `Subtotal` *(Virtual)* | **Price** | Fórmula: `[Total_Mano_Obra] + [Total_Refacciones]` |
| `Descuento` | **Price** | Initial value: `0.00` |
| `Total_General` *(Virtual)* | **Price** | Fórmula: `[Subtotal] - [Descuento]` |
| `Anticipo` | **Price** | Initial value: `0.00` |
| `Saldo_Pendiente` *(Virtual)*| **Price** | Fórmula: `[Total_General] - [Anticipo]` |
| `Metodo_Pago` | **Enum** | `Efectivo`, `Tarjeta Débito/Crédito`, `Transferencia SPEI`, `Pendiente` |
| `Estado_Pago` | **Enum** | `Pendiente`, `Anticipo Parcial`, `Pagado Liquidado` |
| `Foto_Entrada_Frente` | **Image** | Evidencia visual de entrada |
| `Foto_Tablero_Testigos`| **Image** | Evidencia de testigos encendidos |
| `Firma_Cliente_Ingreso`| **Signature** | Firma táctil al dejar el vehículo |
| `Firma_Cliente_Entrega`| **Signature** | Firma táctil al retirar el vehículo |
| `Notas_Internas` | **LongText** | Observaciones del taller |

---

### Tabla `Detalle_Servicios` (Sub-tabla / Items)
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Detalle_Servicio` | **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `ID_Orden` | **Ref** | Referenced table: `Ordenes_Trabajo`. **IsPartOf: Sí** |
| `ID_Servicio` | **Ref** | Referenced table: `Servicios_Catalogo` |
| `Notas_Servicio` | **Text** | Detalle adicional |
| `Costo` | **Price** | Initial value: `[ID_Servicio].[Precio_Sugerido]` |

---

### Tabla `Detalle_Refacciones` (Sub-tabla / Items)
| Columna | Tipo AppSheet | Propiedades / Fórmula |
| :--- | :--- | :--- |
| `ID_Detalle_Refaccion`| **Text** | **Key: Sí**. Initial value: `UNIQUEID()` |
| `ID_Orden` | **Ref** | Referenced table: `Ordenes_Trabajo`. **IsPartOf: Sí** |
| `ID_Refaccion` | **Ref** | Referenced table: `Inventario_Refacciones` |
| `Cantidad` | **Number** | Initial value: `1` |
| `Precio_Unitario` | **Price** | Initial value: `[ID_Refaccion].[Precio_Venta]` |
| `Subtotal` *(Virtual)* | **Price** | Fórmula: `[Cantidad] * [Precio_Unitario]` |

---

## 3. Acciones Rápidas (AppSheet Actions)

### 📲 Acción 1: Notificar al Cliente por WhatsApp con 1 Clic
- **Tabla**: `Ordenes_Trabajo`
- **Do this**: `External: go to a website`
- **Target (URL)**:
```excel
CONCATENATE(
  "https://wa.me/52", 
  [ID_Vehiculo].[ID_Cliente].[Telefono], 
  "?text=", 
  ENCODEURL(
    CONCATENATE(
      "⚡ *SERVICIO AUTOELÉCTRICO BRIBIESCA* ⚡", CHAR(10),
      "Hola Estimado(a) *", [ID_Vehiculo].[ID_Cliente].[Nombre_Completo], "*:", CHAR(10),
      "Le informamos sobre su vehículo *", [ID_Vehiculo].[Marca], " ", [ID_Vehiculo].[Modelo], " (Placas: ", [ID_Vehiculo].[Placa], ")*.", CHAR(10), CHAR(10),
      "📋 *Estatus:* ", [Estado], CHAR(10),
      "🔧 *Diagnóstico:* ", [Diagnostico_Tecnico], CHAR(10),
      "💰 *Total:* $", [Total_General], CHAR(10),
      "💵 *Saldo Pendiente:* $", [Saldo_Pendiente], CHAR(10), CHAR(10),
      "📍 Puede comunicarse o pasar por su unidad en nuestro horario habitual. ¡Gracias por su confianza!"
    )
  )
)
```

### 📞 Acción 2: Llamar Directamente al Cliente
- **Tabla**: `Ordenes_Trabajo`
- **Do this**: `External: start a phone call`
- **Phone number**: `[ID_Vehiculo].[ID_Cliente].[Telefono]`

### 🚀 Acción 3: Avanzar Estado a "Listo para Entrega"
- **Tabla**: `Ordenes_Trabajo`
- **Do this**: `Data: set the values of some columns in this row`
- **Estado**: `"Listo para Entrega"`

---

## 4. Vistas Recomendadas de UX

1. **Órdenes Activas (Tablero Principal)**:
   - Tipo de vista: **Deck** o **Table**.
   - Agrupación: `Estado`.
   - Orden: `Fecha_Ingreso` (Descendente).
2. **Check-in Rápido (Formulario de Recepción)**:
   - Formulario de `Ordenes_Trabajo` con secciones:
     - 1. Datos del Vehículo
     - 2. Prueba Eléctrica Rápida (Voltajes de Batería y Alternador)
     - 3. Falla y Síntomas
     - 4. Fotos y Firma del Cliente
3. **Catálogo de Refacciones**:
   - Tipo de vista: **Card** o **Gallery**.
   - Filtro: `Categoria`.
   - Mostrar indicador de stock y botón para sumar stock.
4. **Historial por Vehículo / Cliente**:
   - Vista detallada del vehículo con lista de todas sus órdenes anteriores.

---

## 5. Permisos que se Necesitan

Para que el sistema funcione al 100%, se requieren los siguientes permisos estructurados en 3 niveles:

### Nivel 1: Permisos de Plataforma (Google Workspace / AppSheet)
1. **Acceso a Google Drive**:
   - Permiso de lectura y escritura para acceder a la hoja de cálculo.
   - Permiso para crear carpetas automáticas donde AppSheet guarda las fotos capturadas y las firmas digitales.
2. **Licencia de AppSheet**:
   - En versión gratuita (Free Prototype) puedes usar la app con hasta **10 usuarios** sin costo.
   - Si se requiere publicación a más de 10 usuarios o envío masivo de correos automatizados, se requiere un plan AppSheet Starter o Core (incluido en varios paquetes de Google Workspace).

### Nivel 2: Permisos del Dispositivo Móvil (Hardware de Teléfonos / Tablets)
Al abrir la app en el teléfono de los mecánicos o recepcionista, solicitará:
1. **Cámara**: Para tomar fotografías del vehículo al entrar, fotos de testigos en el tablero y escanear códigos de barras de refacciones.
2. **Almacenamiento / Galería**: Para guardar copias de tickets y adjuntar imágenes ya tomadas.
3. **Pantalla táctil / Firma**: Permiso de interfaz táctil para recolectar las firmas de los clientes.
4. **Teléfono y Enlaces externos**: Para abrir la app de llamadas y la app de **WhatsApp** automáticamente.
5. **Ubicación GPS (Opcional)**: En caso de activar servicios de auxilio vial o cambio de baterías a domicilio.

### Nivel 3: Permisos y Roles de Seguridad dentro de la App
Configurables en la sección **Security** de AppSheet:
1. **Rol Administrador (Dueño / Encargado)**:
   - Control total: Altas, bajas, cambios.
   - Acceso exclusivo a ver precios de costo de refacciones, margen de ganancia y reportes financieros.
2. **Rol Técnico / Mecánico**:
   - Permiso de lectura en catálogo y vehículos.
   - Permiso de edición únicamente en sus órdenes asignadas para ingresar diagnósticos, refacciones usadas y fotos.
3. **Rol Recepción / Caja**:
   - Registro de nuevos clientes, recepción de vehículos y registro de cobros.
