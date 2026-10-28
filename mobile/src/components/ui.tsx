import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, parseISO } from "date-fns";
import { radius, useColors } from "@/lib/theme";
import { fmtClock, localDateStr, localTimeStr } from "@/lib/format";

export type IconName = keyof typeof Ionicons.glyphMap;

export function Txt({
  children,
  style,
  muted,
  size = 14,
  weight,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  size?: number;
  weight?: TextStyle["fontWeight"];
  numberOfLines?: number;
}) {
  const c = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: muted ? c.mutedForeground : c.foreground, fontSize: size, fontWeight: weight }, style]}
    >
      {children}
    </Text>
  );
}

export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text style={[{ color: c.mutedForeground, fontSize: 11, fontWeight: "600", letterSpacing: 1.6, textTransform: "uppercase" }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, onLongPress }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: 14,
  };
  if (!onPress && !onLongPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: c.muted, borderless: false }}
      style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.muted, ghost: "transparent", danger: c.dangerBg }[variant];
  const fg = { primary: c.primaryForeground, secondary: c.foreground, ghost: c.primary, danger: c.destructive }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 20, label, style }: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [{ padding: 6, borderRadius: 999, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.mutedForeground} />
    </Pressable>
  );
}

export function Field({ label, hint, error, children, right }: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Txt size={13} weight="600">
          {label}
          {hint ? <Text style={{ color: c.mutedForeground, fontWeight: "400" }}> {hint}</Text> : null}
        </Txt>
        {right}
      </View>
      {children}
      {error ? <Text style={{ color: c.destructive, fontSize: 12 }} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const c = useColors();
  const { style, invalid, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={c.mutedForeground}
      {...rest}
      style={[
        {
          borderWidth: 1,
          borderColor: invalid ? c.destructive : c.border,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: c.foreground,
          backgroundColor: c.background,
          fontSize: 15,
        },
        props.multiline && { minHeight: 64, textAlignVertical: "top" },
        style,
      ]}
    />
  );
}

export function NumberInput({ value, onChangeText, ...rest }: Omit<TextInputProps, "keyboardType"> & { value: string; onChangeText: (v: string) => void; invalid?: boolean }) {
  return (
    <Input
      keyboardType="decimal-pad"
      value={value}
      onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ""))}
      {...rest}
    />
  );
}

/** A row of tappable chips. Multi-select when `multiple` is set. */
export function Chips<T extends string>({ options, value, onChange, multiple, small }: {
  options: { value: T; label: string; color?: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multiple?: boolean;
  small?: boolean;
}) {
  const c = useColors();
  const selected = (v: T) => (multiple ? (value as T[]).includes(v) : value === v);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: small ? 9 : 12,
              paddingVertical: small ? 6 : 8,
              minWidth: small ? 36 : undefined,
              justifyContent: "center",
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: on ? c.primary : c.border,
              backgroundColor: on ? c.primary : "transparent",
            }}
          >
            {o.color ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: o.color }} /> : null}
            <Text style={{ color: on ? c.primaryForeground : c.mutedForeground, fontSize: 13, fontWeight: "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Dropdown-style picker that opens a list in a bottom sheet. */
export function Select<T extends string>({ value, options, onChange, placeholder = "Choose…", title }: {
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
  title?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: c.background,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {current?.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: current.color }} /> : null}
          <Txt muted={!current}>{current?.label ?? placeholder}</Txt>
        </View>
        <Ionicons name="chevron-down" size={16} color={c.mutedForeground} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 14,
              paddingHorizontal: 4,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: c.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {o.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.color }} /> : null}
            <Txt style={{ flex: 1 }} weight={o.value === value ? "600" : "400"}>{o.label}</Txt>
            {o.value === value ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt size={13} weight="600">{label}</Txt>
        {hint ? <Txt size={12} muted>{hint}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.muted }} thumbColor="#fff" />
    </View>
  );
}

function PickerButton({ text, placeholder, icon, onPress, onClear }: {
  text: string;
  placeholder: string;
  icon: IconName;
  onPress: () => void;
  onClear?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 11,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: c.background,
      }}
    >
      <Ionicons name={icon} size={16} color={c.mutedForeground} />
      <Txt muted={!text} style={{ flex: 1 }}>{text || placeholder}</Txt>
      {text && onClear ? <IconButton icon="close-circle" size={16} onPress={onClear} label="Clear" style={{ padding: 0 }} /> : null}
    </Pressable>
  );
}

/** value / onChange use "YYYY-MM-DD". */
export function DateField({ value, onChange, placeholder = "Pick a date" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <PickerButton
      icon="calendar-outline"
      text={value ? format(parseISO(value), "EEE, MMM d, yyyy") : ""}
      placeholder={placeholder}
      onPress={() =>
        openDatePicker(value, onChange)
      }
    />
  );
}

export function openDatePicker(value: string, onChange: (v: string) => void) {
  DateTimePickerAndroid.open({
    value: value ? parseISO(value) : new Date(),
    mode: "date",
    onValueChange: (_e, d) => onChange(localDateStr(d)),
  });
}

/** value / onChange use "HH:mm". Empty string means "no time". */
export function TimeField({ value, onChange, placeholder = "Pick a time", clearable }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <PickerButton
      icon="time-outline"
      text={fmtClock(value)}
      placeholder={placeholder}
      onClear={clearable ? () => onChange("") : undefined}
      onPress={() => {
        const base = new Date();
        if (value) {
          const [h, m] = value.split(":").map(Number);
          base.setHours(h, m, 0, 0);
        }
        DateTimePickerAndroid.open({
          value: base,
          mode: "time",
          onValueChange: (_e, d) => onChange(localTimeStr(d)),
        });
      }}
    />
  );
}

/** Bottom sheet built on Modal. Content scrolls; keyboard pushes it up. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: "90%",
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          </View>
          {title ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }}>
              <Txt size={18} weight="700">{title}</Txt>
              <IconButton icon="close" onPress={onClose} label="Close" />
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10, gap: 16 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Banner({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" }) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: tone === "warning" ? c.warningBg : c.muted,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {typeof children === "string" ? <Txt size={12.5} muted={tone === "muted"} style={tone === "warning" ? { color: c.warning } : undefined}>{children}</Txt> : children}
    </View>
  );
}

export function Accordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.card, overflow: "hidden" }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 }}
      >
        <Overline>{title}</Overline>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 14 }}>{children}</View> : null}
    </View>
  );
}

export function ProgressBar({ pct, done }: { pct: number; done?: boolean }) {
  const c = useColors();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: done ? c.success : c.primary, borderRadius: 3 }} />
    </View>
  );
}

export function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
      <Txt size={17} weight="600">{title}</Txt>
      <Txt muted style={{ textAlign: "center" }}>{body}</Txt>
    </View>
  );
}
