import type Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  db.exec(`
    -- User table (Better Auth compatible - singular name)
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      emailVerified INTEGER DEFAULT 0,
      image TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    -- Better Auth session table (singular name)
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expiresAt TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    );

    -- Better Auth account table (singular name)
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      idToken TEXT,
      password TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    );

    -- Better Auth verification table (singular name)
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY NOT NULL,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      floor_plan_url TEXT,
      global_preferences TEXT DEFAULT '{}',
      building_type TEXT,
      architecture_style TEXT,
      atmosphere TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );

    -- Color palette table
    CREATE TABLE IF NOT EXISTS color_palette (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      hex TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Rooms table
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      geometry TEXT DEFAULT '{}',
      doors TEXT DEFAULT '[]',
      windows TEXT DEFAULT '[]',
      fixtures TEXT DEFAULT '[]',
      adjacent_rooms TEXT DEFAULT '[]',
      approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Room images table
    CREATE TABLE IF NOT EXISTS room_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      view_type TEXT DEFAULT 'perspective',
      detected_items TEXT DEFAULT '[]',
      is_final INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    -- Messages table (project-level messages only)
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      room_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
    );

    -- Room messages table (per-room messages)
    CREATE TABLE IF NOT EXISTS room_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    -- Shared designs table
    CREATE TABLE IF NOT EXISTS shared_designs (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_color_palette_project_id ON color_palette(project_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_project_id ON rooms(project_id);
    CREATE INDEX IF NOT EXISTS idx_room_images_room_id ON room_images(room_id);
    CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_project_room ON room_messages(project_id, room_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_shared_designs_project_id ON shared_designs(project_id);

    -- Better Auth indexes
    CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(userId);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(userId);
  `);

  // Add migration for annotated floor plan URL
  const columns = db.pragma("table_info('projects')") as Array<{ name: string }>;
  const hasAnnotatedColumn = columns.some((col) => col.name === 'annotated_floor_plan_url');
  if (!hasAnnotatedColumn) {
    db.exec(`ALTER TABLE projects ADD COLUMN annotated_floor_plan_url TEXT;`);
  }
}
