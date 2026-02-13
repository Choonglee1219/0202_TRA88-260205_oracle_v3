import express, { Request, Response } from "express";
import cors from "cors";
import OracleDB from "oracledb";
import multer from "multer";


const app = express();
const PORT: number = 3001;
let ifcPool: OracleDB.Pool | undefined;

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(express.json({ limit: "2000mb" }));
app.use(express.urlencoded({ limit: "2000mb", extended: true }));

// Multer 설정 (메모리 저장소 사용)
const upload = multer({ storage: multer.memoryStorage() });

// ✅ OracleDB Connection Pool 설정
const ifcPoolConfig = {
  user: "HR",
  password: "123456",
  connectString: "localhost/orcl",
  poolAlias: 'ifcPool',
  poolMax: 10,
  poolMin: 2,
  poolIncrement: 1,
};

// ✅ Connection Pool 생성
async function initPools() {
  try {
    ifcPool = await OracleDB.createPool(ifcPoolConfig);
    console.log("✅ Connection Pool 생성 완료");
    // 애플리케이션 종료 시 Connection Pool 종료
    process.on("SIGTERM", closeDatabase);
    process.on("SIGINT", closeDatabase);
  } catch (err) {
    console.error("❌ Connection Pool 생성 실패:", err);
    throw err; // 에러를 던져서 main() 함수에서 처리하도록 함
  }
}

app.listen(PORT, () => {
  console.log(`✅ Connected successfully on port ${PORT}`);
});    

// ✅ 공통 Connection Pool 연결 함수
async function getConnection(): Promise<OracleDB.Connection> {
  while (!ifcPool) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  try {
    return await ifcPool.getConnection();
  } catch (err) {
    throw new Error(`Connection failed: ${err}`);
  }
}

// ✅ 공통 Connection Pool 종료 함수
async function closePool() {
  if (ifcPool) { await ifcPool.close(10); }
  console.log("Oracle Database connection pools closed");
}

async function closeDatabase() {
  await closePool();
  console.log("Close Database.");
}

// Root
app.get("/", (_req: Request, res: Response) => {
  try {
    res.json({ message: "IFC Viewer" });
  } catch (err) {
    console.error("Error in root endpoint:", err);
    res.status(500).json({ error: "Internal server error" });
  }  
});  

// Get ifcs name
app.get("/api/ifcs/name", async (_req: Request, res: Response): Promise<any> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT "id", "name" FROM "ifc"`,
      [],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
    );  
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching ifcs: ", err);
    res.status(500).json({ error: "Failed to fetch ifcs" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Get IFC
app.get("/api/ifc/:id", async (req: Request, res: Response): Promise<void> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const ifcid = parseInt(req.params.id, 10);
    if (isNaN(ifcid)) {
      res.status(400).json({ error: "ifc id 가 숫자가 아님!" });
      return;
    }
    const result = await connection.execute(
      `SELECT "content", "name" FROM "ifc" WHERE "id" = :id`,
      { id: ifcid },
      { 
        outFormat: OracleDB.OUT_FORMAT_OBJECT,
        fetchInfo: { content: { type: OracleDB.BUFFER } },
      } as any
    );  
    const ifc = result.rows?.[0] as {
      content: Buffer | null,
      name: string | null
    };
    if (!ifc || !ifc.content) {
      console.warn(`IFC data not found for id: ${ifcid}`);
      res.status(404).json({ error: "IFC data not found" });
      return;
    }  
    const base64Content = ifc.content.toString("base64");
    res.json({ name: ifc.name, content: base64Content });
  } catch (err) {
    console.error("Error fetching IFC:", err);
    res.status(500).json({ error: "Failed to fetch IFC" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Post IFC
app.post("/api/ifc", upload.single("file"), async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const name = req.file.originalname;
    const bufferContent = req.file.buffer;
    
    const sql = `INSERT INTO "ifc" ("name", "content") VALUES (:name, :content) RETURNING "id" INTO :id`;

    const result = await connection.execute<{ id: number[] }> (
      sql,
      {
        name: {
          val: name,
          type: OracleDB.DB_TYPE_VARCHAR,
        },
        content: {
          val: bufferContent,
          type: OracleDB.DB_TYPE_BLOB,
        },
        id: { 
          type: OracleDB.DB_TYPE_NUMBER, 
          dir: OracleDB.BIND_OUT, 
        },
      },  
      { autoCommit: true },
    );  
    if (result.outBinds && Array.isArray(result.outBinds.id) && result.outBinds.id.length > 0) {
      res.status(201).json({
        message: "IFC inserted successfully",
        id: result.outBinds.id[0],
      });  
    } else {
      console.error("Error inserting IFC: No ID returned");
      res.status(500).json({ error: "Failed to insert IFC" });
    }  
  } catch (err) {
    console.error("Error reading or inserting the ifc file: ", err);
    res.status(500).json({ error: "Failed to insert IFC: ", details: err instanceof Error ? err.message : String(err) });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Delete IFC
app.delete("/api/ifc/:id", async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const ifcid = parseInt(req.params.id, 10);
    if (Number.isNaN(ifcid)) {
      res.status(400).json({ error: "Invalid IFC ID" });
      return;
    }

    const result = await connection.execute(
      `DELETE FROM "ifc" WHERE "id" = :id`,
      { id: ifcid },
      { autoCommit: true },
    );
    if (result.rowsAffected && result.rowsAffected > 0) {
      console.log(`IFC with ID ${ifcid} deleted successfully.`);
      res.status(200).json({ message: "IFC deleted successfully." });
    } else {
      console.warn(`IFC with ID ${ifcid} not found.`);
      res.status(404).json({ error: "IFC not found." });
    }
  } catch (err) {
    console.error("Error deleting IFC:", err);
    res.status(500).json({ error: "Failed to delete IFC" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

// Get frags name
app.get("/api/frags/name", async (_req: Request, res: Response): Promise<any> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT "id", "name" FROM "frag"`,
      [],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
    );  
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching frags: ", err);
    res.status(500).json({ error: "Failed to fetch frags" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Get FRAG
app.get("/api/frag/:id", async (req: Request, res: Response): Promise<void> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const fragid = parseInt(req.params.id, 10);
    if (isNaN(fragid)) {
      res.status(400).json({ error: "frag id 가 숫자가 아님!" });
      return;
    }
    const result = await connection.execute(
      `SELECT "content", "name" FROM "frag" WHERE "id" = :id`,
      { id: fragid },
      { 
        outFormat: OracleDB.OUT_FORMAT_OBJECT,
        fetchInfo: { content: { type: OracleDB.BUFFER } },
      } as any
    );  
    const frag = result.rows?.[0] as {
      content: Buffer | null,
      name: string | null
    };
    if (!frag || !frag.content) {
      console.warn(`FRAG data not found for id: ${fragid}`);
      res.status(404).json({ error: "FRAG data not found" });
      return;
    }  
    const base64Content = frag.content.toString("base64");
    res.json({ name: frag.name, content: base64Content });
  } catch (err) {
    console.error("Error fetching FRAG:", err);
    res.status(500).json({ error: "Failed to fetch FRAG" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Post FRAG
app.post("/api/frag", upload.single("file"), async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const name = req.file.originalname;
    const bufferContent = req.file.buffer;
    
    const sql = `INSERT INTO "frag" ("name", "content") VALUES (:name, :content) RETURNING "id" INTO :id`;

    const result = await connection.execute<{ id: number[] }> (
      sql,
      {
        name: {
          val: name,
          type: OracleDB.DB_TYPE_VARCHAR,
        },
        content: {
          val: bufferContent,
          type: OracleDB.DB_TYPE_BLOB,
        },
        id: { 
          type: OracleDB.DB_TYPE_NUMBER, 
          dir: OracleDB.BIND_OUT, 
        },
      },  
      { autoCommit: true },
    );  
    if (result.outBinds && Array.isArray(result.outBinds.id) && result.outBinds.id.length > 0) {
      res.status(201).json({
        message: "FRAG inserted successfully",
        id: result.outBinds.id[0],
      });  
    } else {
      console.error("Error inserting FRAG: No ID returned");
      res.status(500).json({ error: "Failed to insert FRAG" });
    }  
  } catch (err) {
    console.error("Error reading or inserting the frag file: ", err);
    res.status(500).json({ error: "Failed to insert FRAG: ", details: err instanceof Error ? err.message : String(err) });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Delete FRAG
app.delete("/api/frag/:id", async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const fragid = parseInt(req.params.id, 10);
    if (Number.isNaN(fragid)) {
      res.status(400).json({ error: "Invalid FRAG ID" });
      return;
    }

    const result = await connection.execute(
      `DELETE FROM "frag" WHERE "id" = :id`,
      { id: fragid },
      { autoCommit: true },
    );
    if (result.rowsAffected && result.rowsAffected > 0) {
      console.log(`FRAG with ID ${fragid} deleted successfully.`);
      res.status(200).json({ message: "FRAG deleted successfully." });
    } else {
      console.warn(`FRAG with ID ${fragid} not found.`);
      res.status(404).json({ error: "FRAG not found." });
    }
  } catch (err) {
    console.error("Error deleting FRAG:", err);
    res.status(500).json({ error: "Failed to delete FRAG" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});

// Get bcfs name
app.get("/api/bcfs/name", async (_req: Request, res: Response): Promise<any> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT "id", "name", "ifcid" FROM "bcf"`,
      [],
      { outFormat: OracleDB.OUT_FORMAT_OBJECT },
    );  
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching bcfs: ", err);
    res.status(500).json({ error: "Failed to fetch bcfs" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Get BCF
app.get("/api/bcf/:id", async (req: Request, res: Response): Promise<void> => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const bcfId = parseInt(req.params.id, 10);
    if (isNaN(bcfId)) {
      res.status(400).json({ error: "bcf id 가 숫자가 아님!" });
      return;
    }
    const result = await connection.execute(
      `SELECT "content", "name" FROM "bcf" WHERE "id" = :id`,
      { id: bcfId },
      { 
        outFormat: OracleDB.OUT_FORMAT_OBJECT,
        fetchInfo: { content: { type: OracleDB.BUFFER } },
      } as any
    );  
    const bcf = result.rows?.[0] as {
      content: Buffer | null,
      name: string | null
    };
    if (!bcf || !bcf.content) {
      console.warn(`BCF data not found for id: ${bcfId}`);
      res.status(404).json({ error: "BCF data not found" });
      return;
    }  
    const base64Content = bcf.content.toString("base64");
    res.json({ name: bcf.name, content: base64Content });
  } catch (err) {
    console.error("Error fetching BCF:", err);
    res.status(500).json({ error: "Failed to fetch BCF" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Post BCF
app.post("/api/bcf", upload.single("file"), async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    
    const name = req.file.originalname;
    const bufferContent = req.file.buffer;
    
    // Validate ifcid
    const rawifcid = req.body.ifcid;
    if (rawifcid === undefined || rawifcid === null || rawifcid === "") {
      return res.status(400).json({ error: "ifcid is required." });
    }

    const parsedifcid = Number(rawifcid);
    if (!Number.isInteger(parsedifcid)) {
      return res.status(400).json({ error: "Invalid ifcid format. Must be an integer." });
    }

    // Debug log for BCF insertion
    console.log("BCF Insert Debug:", {
      name,
      bufferIsBuffer: Buffer.isBuffer(bufferContent),
      bufferLength: bufferContent?.length,
      rawifcid,
      parsedifcid,
      parsedifcidType: typeof parsedifcid,
    });

    const sql = `INSERT INTO "bcf" ("name", "content", "ifcid") VALUES (:name, :content, :ifcid) RETURNING "id" INTO :id`;
    console.log("Executing SQL:", sql);

    const result = await connection.execute<{ id: number[] }> (
      sql,
      {
        name: {
          val: name,
          type: OracleDB.DB_TYPE_VARCHAR,
          dir: OracleDB.BIND_IN,
        },
        content: {
          val: bufferContent,
          type: OracleDB.DB_TYPE_BLOB,
          dir: OracleDB.BIND_IN,
        },
        ifcid: {
          val: parsedifcid,
          type: OracleDB.DB_TYPE_NUMBER,
          dir: OracleDB.BIND_IN,
        },
        id: { 
          type: OracleDB.DB_TYPE_NUMBER,
          dir: OracleDB.BIND_OUT,
        },
      },  
      { autoCommit: true, outFormat: OracleDB.OUT_FORMAT_OBJECT},
    );  
    if (result.outBinds && Array.isArray(result.outBinds.id) && result.outBinds.id.length > 0) {
      res.status(201).json({
        message: "BCF inserted successfully",
        id: result.outBinds.id[0],
      });  
    } else {
      console.error("Error inserting BCF: No ID returned");
      res.status(500).json({ error: "Failed to insert BCF" });
    }  
  } catch (err) {
    console.error("Error reading or inserting the bcf file:", err);
    res.status(500).json({ error: "Failed to insert BCF", details: err instanceof Error ? err.message : String(err) });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }  
    }  
  }  
});  

// Delete BCF
app.delete("/api/bcf/:id", async (req: Request, res: Response) => {
  let connection: OracleDB.Connection | undefined;
  try {
    connection = await getConnection();
    const bcfId = parseInt(req.params.id, 10);
    if (Number.isNaN(bcfId)) {
      res.status(400).json({ error: "Invalid BCF ID" });
      return;
    }

    const result = await connection.execute(
      `DELETE FROM "bcf" WHERE "id" = :id`,
      { id: bcfId },
      { autoCommit: true },
    );
    if (result.rowsAffected && result.rowsAffected > 0) {
      console.log(`BCF with ID ${bcfId} deleted successfully.`);
      res.status(200).json({ message: "BCF deleted successfully." });
    } else {
      console.warn(`BCF with ID ${bcfId} not found.`);
      res.status(404).json({ error: "BCF not found." });
    }
  } catch (err) {
    console.error("Error deleting BCF:", err);
    res.status(500).json({ error: "Failed to delete BCF" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
});


// Database Table setting (Oracle)
const ifcSQL = `
  CREATE TABLE "ifc" (
    "id" NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "name" VARCHAR2(255) NOT NULL,
    "content" BLOB
  )  
`;  

const fragSQL = `
  CREATE TABLE "frag" (
    "id" NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "name" VARCHAR2(255) NOT NULL,
    "content" BLOB
  )  
`;

const bcfSQL = `
  CREATE TABLE "bcf" (
    "id" NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "name" VARCHAR2(255) NOT NULL,
    "content" BLOB,
    "ifcid" NUMBER NOT NULL,
    CONSTRAINT "fk_bcf_ifc" FOREIGN KEY ("ifcid") REFERENCES "ifc"("id")
  )  
`;  

async function setupDatabase() {
  let connection;
  try {
    connection = await getConnection();
    try {
      await connection.execute(ifcSQL);
    } catch (error) {
      console.error("Error setting up ifc table:", error);
    }
    try {
      await connection.execute(fragSQL);
    } catch (error) {
      console.error("Error setting up frag table:", error);
    }
    try {
      await connection.execute(bcfSQL);
    } catch (error) {
      console.error("Error setting up bcf table:", error);
    }
  } catch (error) {
    console.error("Error setting up database:", error);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}

initPools();