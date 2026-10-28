import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createGroup, deleteGroup, getAllGroups, updateGroup } from "@/lib/services/groups";
import { getAllHabits } from "@/lib/services/habits";
import { getAllEventsIncludingCompleted } from "@/lib/db/events";
import { DEFAULT_GROUP_COLOR, GROUP_PALETTE } from "@/lib/groups-palette";
import type { Group } from "@/lib/types";
import { useLoader } from "@/lib/useLoader";
import { useColors } from "@/lib/theme";
import { toast, toastError } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, Sheet, Txt } from "@/components/ui";

async function load() {
  const [groups, habits, events] = await Promise.all([getAllGroups(), getAllHabits(), getAllEventsIncludingCompleted()]);
  return { groups, habits, events };
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {GROUP_PALETTE.map((p) => (
        <Pressable
          key={p.hex}
          onPress={() => onChange(p.hex)}
          accessibilityLabel={p.name}
          accessibilityState={{ selected: value === p.hex }}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.hex, alignItems: "center", justifyContent: "center", borderWidth: value === p.hex ? 3 : 0, borderColor: c.foreground }}
        >
          {value === p.hex ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </Pressable>
      ))}
    </View>
  );
}

export default function GroupsScreen() {
  const { data } = useLoader(load, []);
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_GROUP_COLOR);
  const [busy, setBusy] = useState(false);
  const groups = data?.groups ?? [];

  function open(g: Group | "new") {
    setEditing(g);
    setName(g === "new" ? "" : g.name);
    setColor(g === "new" ? DEFAULT_GROUP_COLOR : g.color);
  }

  async function save() {
    if (!name.trim()) return toastError("Name is required");
    setBusy(true);
    const r = editing === "new" ? await createGroup({ name: name.trim(), color }) : await updateGroup((editing as Group).id, { name: name.trim(), color });
    setBusy(false);
    if (r.error) return toastError("Couldn't save group", r.error);
    toast("Saved");
    setEditing(null);
  }

  function remove(g: Group) {
    Alert.alert(`Delete "${g.name}"?`, "Habits and events in this group stay, they just lose the group.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const r = await deleteGroup(g.id);
          if (r.error) return toastError("Couldn't delete group", r.error);
          setEditing(null);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <Button title="New group" icon="add" variant="secondary" onPress={() => open("new")} />
        {data && groups.length === 0 ? <EmptyState emoji="🏷️" title="No groups yet" body="Groups colour-code habits and events and let you filter Today." /> : null}
        {groups.map((g) => {
          const habits = data!.habits.filter((h) => h.group_id === g.id);
          const events = data!.events.filter((e) => e.group_id === g.id);
          const count = habits.length + events.length;
          return (
            <Card key={g.id} onPress={() => open(g)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: g.color }} />
              <View style={{ flex: 1 }}>
                <Txt weight="600">{g.name}</Txt>
                <Txt size={12} muted numberOfLines={1}>
                  {count} item{count !== 1 ? "s" : ""}
                  {count > 0 ? ` · ${[...habits.map((h) => h.name), ...events.map((e) => e.title)].slice(0, 3).join(", ")}` : ""}
                </Txt>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Sheet open={editing != null} onClose={() => setEditing(null)} title={editing === "new" ? "New group" : "Edit group"}>
        <Field label="Name"><Input value={name} onChangeText={setName} placeholder="e.g. Health" autoFocus /></Field>
        <Field label="Colour"><ColorPicker value={color} onChange={setColor} /></Field>
        <Button title="Save" onPress={save} loading={busy} />
        {editing && editing !== "new" ? <Button title="Delete group" variant="danger" onPress={() => remove(editing)} /> : null}
      </Sheet>
    </View>
  );
}
