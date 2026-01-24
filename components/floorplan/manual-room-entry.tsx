'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RoomEntry {
  name: string;
  type: string;
}

const ROOM_TYPES = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Dining',
  'Office',
  'Hallway',
  'Closet',
  'Laundry',
  'Other',
];

interface ManualRoomEntryProps {
  projectId: number;
  onComplete: () => void;
}

export function ManualRoomEntry({ projectId, onComplete }: ManualRoomEntryProps) {
  const [rooms, setRooms] = useState<RoomEntry[]>([
    { name: '', type: 'Living Room' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRoom = () => {
    setRooms([...rooms, { name: '', type: 'Bedroom' }]);
  };

  const removeRoom = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index));
    }
  };

  const updateRoom = (index: number, field: keyof RoomEntry, value: string) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    setRooms(updated);
  };

  const handleSubmit = async () => {
    // Validate
    const validRooms = rooms.filter((r) => r.name.trim() !== '');
    if (validRooms.length === 0) {
      setError('Please add at least one room with a name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create rooms via API
      for (const room of validRooms) {
        const res = await fetch(`/api/projects/${projectId}/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: room.name,
            type: room.type,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create room');
        }
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Rooms Manually</CardTitle>
        <CardDescription>
          Enter the rooms in your space to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rooms.map((room, index) => (
          <div key={index} className="flex gap-3 items-start">
            <div className="flex-1">
              <Input
                placeholder="Room name (e.g., Master Bedroom)"
                value={room.name}
                onChange={(e) => updateRoom(index, 'name', e.target.value)}
              />
            </div>
            <div className="w-40">
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={room.type}
                onChange={(e) => updateRoom(index, 'type', e.target.value)}
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRoom(index)}
              disabled={rooms.length === 1}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addRoom}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Another Room
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating rooms...
            </>
          ) : (
            'Continue to Design'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
