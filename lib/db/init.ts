import type Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  db.exec(`
    -- Drop tables in reverse dependency order
    DROP TABLE IF EXISTS shared_designs;
    DROP TABLE IF EXISTS room_messages;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS room_images;
    DROP TABLE IF EXISTS rooms;
    DROP TABLE IF EXISTS color_palette;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS users;

    -- Users table
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Projects table (NEW COLUMNS: building_type, architecture_style, atmosphere)
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      floor_plan_url TEXT,
      global_preferences TEXT DEFAULT '{}',
      building_type TEXT,
      architecture_style TEXT,
      atmosphere TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Color palette table (NEW)
    CREATE TABLE color_palette (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      hex TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Rooms table
    CREATE TABLE rooms (
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
    CREATE TABLE room_images (
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
    CREATE TABLE messages (
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

    -- Room messages table (NEW - per-room messages)
    CREATE TABLE room_messages (
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
    CREATE TABLE shared_designs (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX idx_projects_user_id ON projects(user_id);
    CREATE INDEX idx_color_palette_project_id ON color_palette(project_id);
    CREATE INDEX idx_rooms_project_id ON rooms(project_id);
    CREATE INDEX idx_room_images_room_id ON room_images(room_id);
    CREATE INDEX idx_messages_project_id ON messages(project_id);
    CREATE INDEX idx_messages_room_id ON messages(room_id);
    CREATE INDEX idx_room_messages_project_room ON room_messages(project_id, room_id);
    CREATE INDEX idx_room_messages_room_id ON room_messages(room_id);
    CREATE INDEX idx_shared_designs_project_id ON shared_designs(project_id);
  `);

  // Add migration for annotated floor plan URL
  const columns = db.pragma("table_info('projects')") as Array<{ name: string }>;
  const hasAnnotatedColumn = columns.some((col) => col.name === 'annotated_floor_plan_url');
  if (!hasAnnotatedColumn) {
    db.exec(`ALTER TABLE projects ADD COLUMN annotated_floor_plan_url TEXT;`);
  }
}
