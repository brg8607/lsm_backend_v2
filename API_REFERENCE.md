# LSM Backend API Reference

Base URL: `http://localhost:3000`

## A. Authentication

### 1. Register User
**POST** `/api/auth/register`

Creates a new user account.

**Body:**
```json
{
  "nombre": "Juan Perez",
  "correo": "juan@example.com",
  "password": "securePassword123"
}
```

**Responses:**

*   **201 Created**
    ```json
    {
      "mensaje": "Usuario creado",
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "usuario": {
        "id": 1,
        "nombre": "Juan Perez",
        "tipo": "normal"
      }
    }
    ```

*   **400 Bad Request** (Missing data or Email exists)
    ```json
    { "error": "Faltan datos" }
    // OR
    { "error": "El correo ya existe" }
    ```

### 2. Login
**POST** `/api/auth/login`

Authenticates a user and returns a JWT token.

**Body:**
```json
{
  "correo": "juan@example.com",
  "password": "securePassword123"
}
```

**Responses:**

*   **200 OK**
    ```json
    {
      "mensaje": "Login exitoso",
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "usuario": {
        "id": 1,
        "nombre": "Juan Perez",
        "tipo_usuario": "normal"
      }
    }
    ```

*   **400 Bad Request** (User not found, wrong password, or Google account)
    ```json
    { "error": "Usuario no encontrado" }
    // OR
    { "error": "Contraseña incorrecta" }
    // OR
    { "error": "Usa login con Google" }
    ```

### 3. Google Login/Register
**POST** `/api/auth/google`

Logs in or registers a user via Google.

**Body:**
```json
{
  "token_google": "google_token_here",
  "nombre": "Juan Google",
  "correo": "juan.google@gmail.com",
  "google_uid": "1234567890"
}
```

**Responses:**

*   **200 OK** (Login successful) / **201 Created** (New user registered)
    ```json
    {
      "mensaje": "Login Google exitoso", // or "Usuario Google creado"
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "usuario": {
        "id": 2,
        "nombre": "Juan Google",
        "tipo_usuario": "normal"
      }
    }
    ```

### 4. Guest Login
**POST** `/api/auth/guest`

Creates a temporary guest session.

**Body:** None

**Responses:**

*   **200 OK**
    ```json
    {
      "mensaje": "Ingreso como invitado",
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "usuario": {
        "id": 3,
        "nombre": "Invitado 482",
        "tipo_usuario": "invitado"
      }
    }
    ```

---

## B. Content

### 5. Get Categories
**GET** `/api/categorias`

Returns all available categories.

**Responses:**

*   **200 OK**
    ```json
    [
      {
        "id": 1,
        "nombre": "Abecedario",
        "icon_url": "🅰️",
        "descripcion": null
      },
      {
        "id": 2,
        "nombre": "Animales",
        "icon_url": "🐶",
        "descripcion": null
      }
    ]
    ```

### 6. Get Signs (Search/Filter)
**GET** `/api/senas`

Returns signs, optionally filtered by category or search term.

**Query Params:**
*   `categoria_id` (optional): Filter by category ID.
*   `busqueda` (optional): Search by word (e.g., "perro").

**Examples:**
*   `/api/senas?categoria_id=2`
*   `/api/senas?busqueda=aguacate`

**Responses:**

*   **200 OK**
    ```json
    [
      {
        "id": 550,
        "categoria_id": 23,
        "palabra": "Aguacate",
        "descripcion": null,
        "video_url": "/uploads/Verduras/Aguacate.m4v",
        "audio_url": null,
        "imagen_url": null,
        "categoria_nombre": "Verduras"
      }
    ]
    ```

### 7. Get Sign Detail
**GET** `/api/senas/:id`

Returns details for a specific sign.

**Responses:**

*   **200 OK**
    ```json
    {
      "id": 550,
      "categoria_id": 23,
      "palabra": "Aguacate",
      "descripcion": null,
      "video_url": "/uploads/Verduras/Aguacate.m4v",
      ...
    }
    ```

*   **404 Not Found**
    ```json
    { "error": "Seña no encontrada" }
    ```

---

## C. Activities (Quizzes)

### 8. Get Daily Quiz
**GET** `/api/quiz/hoy`

**Headers:**
*   `Authorization`: `Bearer <token>`

**Responses:**

*   **200 OK**
    ```json
    {
      "id": 5,
      "titulo": "Quiz del Día",
      "preguntas": [
        {
          "id": 101,
          "pregunta_texto": "¿Qué significa esta seña?",
          "video_url": "/uploads/...",
          "opciones": ["Perro", "Gato", "Pez", "Ave"]
        }
      ]
    }
    ```

*   **404 Not Found** (No quiz scheduled for today)
    ```json
    { "error": "No hay quiz programado para hoy" }
    ```

*   **401 Unauthorized** (Missing token) / **403 Forbidden** (Invalid token)

### 9. Submit Quiz Result
**POST** `/api/quiz/resultado`

**Headers:**
*   `Authorization`: `Bearer <token>`

**Body:**
```json
{
  "quiz_id": 5,
  "puntaje": 80
}
```

**Responses:**

*   **201 Created**
    ```json
    {
      "mensaje": "Puntaje guardado",
      "nuevos_puntos": 80
    }
    ```

---

## D. User Progress

### 10. Get User Progress
**GET** `/api/progreso`

Returns progress percentage for all categories.

**Headers:**
*   `Authorization`: `Bearer <token>`

**Responses:**

*   **200 OK**
    ```json
    [
      {
        "categoria_id": 1,
        "nombre": "Abecedario",
        "porcentaje": 100
      },
      {
        "categoria_id": 2,
        "nombre": "Animales",
        "porcentaje": 15
      }
    ]
    ```

### 11. Update Progress
**POST** `/api/progreso/actualizar`

Updates progress for a specific category.

**Headers:**
*   `Authorization`: `Bearer <token>`

**Body:**
```json
{
  "categoria_id": 2,
  "incremento": 5
}
```

**Responses:**

*   **200 OK**
    ```json
    {
      "mensaje": "Progreso actualizado", // or "Progreso iniciado"
      "porcentaje": 20
    }
    ```

---

## E. Admin

### 12. Upload New Sign
**POST** `/api/admin/senas`

**Headers:**
*   `Authorization`: `Bearer <admin_token>`
*   `Content-Type`: `multipart/form-data`

**Body (Form Data):**
*   `palabra`: "Gato"
*   `categoria_id`: 2
*   `descripcion`: "Animal felino..."
*   `video`: (File)

**Responses:**

*   **201 Created**
    ```json
    {
      "mensaje": "Seña creada",
      "id": 600
    }
    ```

*   **400 Bad Request** (Missing video)
    ```json
    { "error": "Video requerido" }
    ```

*   **403 Forbidden** (User is not admin)
    ```json
    { "error": "Acceso denegado: Se requiere administrador" }
    ```

### 13. Delete Sign
**DELETE** `/api/admin/senas/:id`

**Headers:**
*   `Authorization`: `Bearer <admin_token>`

**Responses:**

*   **200 OK**
    ```json
    { "mensaje": "Seña eliminada" }
    ```

### 13b. Edit Sign
**PUT** `/api/admin/senas/:id`

**Headers:**
*   `Authorization`: `Bearer <admin_token>`

**Body:**
```json
{
  "palabra": "Gato Modificado",
  "descripcion": "Nueva descripción...",
  "categoria_id": 2
}
```

**Responses:**

*   **200 OK**
    ```json
    { "mensaje": "Seña actualizada" }
    ```

*   **404 Not Found**
    ```json
    { "error": "Seña no encontrada" }
    ```

### 13c. Create Quiz
**POST** `/api/admin/quiz`

**Headers:**
*   `Authorization`: `Bearer <admin_token>`

**Body:**
```json
{
  "titulo": "Quiz de Fin de Semana",
  "fecha_disponible": "2023-12-01",
  "preguntas": [
    {
      "pregunta_texto": "¿Qué es esto?",
      "video_asociado_url": "/uploads/...",
      "opcion_correcta": "Perro",
      "opcion_incorrecta1": "Gato",
      "opcion_incorrecta2": "Pez",
      "opcion_incorrecta3": "Ave"
    }
  ]
}
```

**Responses:**

*   **201 Created**
    ```json
    {
      "mensaje": "Quiz creado exitosamente",
      "id": 10
    }
    ```

### 14. Get Dashboard Stats
**GET** `/api/admin/stats`

**Headers:**
*   `Authorization`: `Bearer <admin_token>`

**Responses:**

*   **200 OK**
    ```json
    {
      "total_usuarios": 150,
      "total_senas": 300,
      "quizzes_completados": 1200
    }
    ```

---

## F. Courses (Module)

### 15. Get Courses (Categories)
**GET** `/api/cursos`

Alias for `/api/categorias`.

**Responses:**
*   **200 OK** (Same as Categories)

### 16. Get Course Lessons (Signs)
**GET** `/api/cursos/:id/lecciones`

Alias for `/api/senas` (filtered by category).

**Responses:**
*   **200 OK** (Same as Signs)
