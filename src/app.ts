import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import OracleDB from "oracledb";
import multer from "multer";


const app = express();
const PORT: number = 3001;
const IFC_BASE_PATH = "D:/";
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
    // edbPool = await OracleDB.createPool(edbPoolConfig);
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
    // 디버깅용
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
    const ifcId = parseInt(req.params.id, 10);
    if (isNaN(ifcId)) {
      res.status(400).json({ error: "ifc id 가 숫자가 아님!" });
      return;
    }
    const result = await connection.execute(
      `SELECT "content", "name" FROM "ifc" WHERE "id" = :id`,
      { id: ifcId },
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
      console.warn(`IFC data not found for id: ${ifcId}`);
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
    
    const result = await connection.execute<{ id: number }> (
      `INSERT INTO "ifc" ("name", "content") VALUES (:name, :content) RETURNING "id" INTO :id`,
      {
        name: name,
        content: bufferContent,
        id: { type: OracleDB.NUMBER, dir: OracleDB.BIND_OUT },
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
    console.error("Error reading or inserting the ifc file:", err);
    res.status(500).json({ error: "Failed to insert IFC" });
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
    const ifcId = parseInt(req.params.id, 10);
    if (Number.isNaN(ifcId)) {
      res.status(400).json({ error: "Invalid IFC ID" });
      return;
    }

    const result = await connection.execute(
      `DELETE FROM "ifc" WHERE "id" = :id`,
      { id: ifcId },
      { autoCommit: true },
    );
    if (result.rowsAffected && result.rowsAffected > 0) {
      console.log(`IFC with ID ${ifcId} deleted successfully.`);
      res.status(200).json({ message: "IFC deleted successfully." });
    } else {
      console.warn(`IFC with ID ${ifcId} not found.`);
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


// Database Table setting (Oracle)
const ifcSQL = `
  CREATE TABLE "ifc" (
    "id" NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "name" VARCHAR2(255),
    "content" BLOB
  )  
`;  

async function setupIfcDatabase() {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute(ifcSQL);
  } catch (error) {
    console.error("Error setting up ifc database:", error);
  }  
}  

async function insertIfcSQL() {
  let connection;
  try {
    connection = await getConnection();
    const ifcFiles: any = [];
    const insertIfcSQL = `
      INSERT INTO "ifc" ("name", "content")
      VALUES (:name, :content)
    `;  

    for (const fileName of ifcFiles) {
      const filePath = path.join(IFC_BASE_PATH, fileName);

      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        continue;
      }  

      const name = path.basename(fileName, ".ifc");
      const fileContent = fs.readFileSync(filePath);

      await connection.execute (
        insertIfcSQL,
        { name: name, content: fileContent },
        { autoCommit: true },
      );  
      console.log(`IFC file ${name} inserted into the ifc database.`);
    }  
  } catch (err) {
    console.error("Error reading or inserting the files:", err);
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

async function selectIFCs() {
  let connection;
  try {
    connection = await getConnection();
    const selectIFCSQL = `SELECT "id" FROM "ifc"`;
    const result = await connection.execute(selectIFCSQL, {}, {
      outFormat: OracleDB.OUT_FORMAT_OBJECT,
    });  
    if (result.rows && result.rows.length > 0) {
      console.log("Retrieved rows:", result.rows);
    } else {
      console.log("No row found with the given ID.");
    }  
  } catch (err) {
    console.error("Error selecting IFCs:", err);
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

async function selectIFC(id: number) {
  let connection;
  try {
    connection = await getConnection();
    const selectIFCSQL = `SELECT * FROM "ifc" WHERE "id" = :id`;
    const result = await connection.execute(selectIFCSQL, { id: id }, {
      outFormat: OracleDB.OUT_FORMAT_OBJECT,
    });  
    if (result.rows && result.rows.length > 0) {
      console.log("Retrieved row:", result.rows[0]);
    } else {
      console.log("No row found with the given ID.");
    }  
  } catch (err) {
    console.error("Error selecting IFC:", err);
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

async function deleteIFC(id: number) {
  let connection;
  try {
    connection = await getConnection();
    const deleteIFCSQL = `DELETE FROM "ifc" WHERE "id" = :id`;
    const result = await connection.execute(deleteIFCSQL, { id: id }, { autoCommit: true });
    if (result.rowsAffected && result.rowsAffected > 0) {
      console.log(`IFC with ID ${id} deleted successfully.`);
    } else {
      console.log("No row found with the given ID.");
    }  
  } catch (err) {
    console.error("Error deleting IFC:", err);
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


// async function main() {
//   try {
//     await initDB();
//     await setupIfcDatabase();

//     await insertIfcSQL();

//   } catch (error) {
//     console.error("An error occurred:", error);
//   }
// }

// main();
initPools();