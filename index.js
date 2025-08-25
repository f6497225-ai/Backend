import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const storage = multer.memoryStorage();
const upload = multer({ storage });

const supabaseUrl = "https://emhlearfdefwwaxalnef.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtaGxlYXJmZGVmd3dheGFsbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNzIwOTQsImV4cCI6MjA3MTY0ODA5NH0.LNbnylTRJqP3GMrD-_E7ohgF1Zwx-_m0B-tlu3nT8K0";
const supabase = createClient(supabaseUrl, supabaseKey);

const pool = new Pool({
  connectionString: "postgres://postgres.emhlearfdefwwaxalnef:q%4015932678Aq@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

const subirImagen = async (file) => {
  if (!file) return null;

  try {
    const fileName = `${Date.now()}_${file.originalname}`;
    
    const { data, error } = await supabase.storage
      .from("up")
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      console.error("Error al subir imagen:", error);
      return null;
    }

    const { data: publicUrlData, error: urlError } = supabase.storage
      .from("up")
      .getPublicUrl(fileName);

    if (urlError) {
      console.error("Error al obtener URL pública:", urlError);
      return null;
    }

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Excepción al subir imagen:", err);
    return null;
  }
};

app.get("/clientes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clientes ORDER BY fecha_registro DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener clientes:", err);
    res.status(500).json({ error: "Error en la base de datos", details: err?.message || err });
  }
});

app.post("/clientes", upload.fields([
  { name: "foto_frente" }, { name: "foto_espalda" },
  { name: "foto_izquierda" }, { name: "foto_derecha" }
]), async (req, res) => {
  try {
    const { nombre, correo, telefono, fecha_nacimiento, altura, altura_unidad, peso, peso_unidad, enfermedades, incapacidades, modalidad } = req.body;
    if (!nombre || !correo || !telefono) return res.status(400).json({ error: "Nombre, correo y teléfono son obligatorios" });

    const files = req.files || {};
    const foto_frente = await subirImagen(files.foto_frente ? files.foto_frente[0] : null);
    const foto_espalda = await subirImagen(files.foto_espalda ? files.foto_espalda[0] : null);
    const foto_izquierda = await subirImagen(files.foto_izquierda ? files.foto_izquierda[0] : null);
    const foto_derecha = await subirImagen(files.foto_derecha ? files.foto_derecha[0] : null);

    const result = await pool.query(
      `INSERT INTO clientes
       (nombre, correo, telefono, fecha_nacimiento, altura, altura_unidad, peso, peso_unidad,
        enfermedades, incapacidades, modalidad, foto_frente, foto_espalda, foto_izquierda, foto_derecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [nombre, correo, telefono, fecha_nacimiento ? new Date(fecha_nacimiento) : null,
       altura ? Number(altura) : null, altura_unidad || 'cm', peso ? Number(peso) : null,
       peso_unidad || 'kg', enfermedades || null, incapacidades || null, modalidad || null,
       foto_frente, foto_espalda, foto_izquierda, foto_derecha]
    );

    res.status(201).json({ cliente: result.rows[0] });
  } catch (err) {
    console.error("Error al registrar cliente:", err);
    res.status(500).json({ error: "Error al insertar cliente", details: err?.message || err });
  }
});

app.listen(3000, () => console.log("API corriendo en http://localhost:3000"));
