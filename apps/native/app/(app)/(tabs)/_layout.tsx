import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FinnTabButtonProps = {
  accessibilityState?: {
    selected?: boolean;
  };
  children?: ReactNode;
  onPress?: ComponentProps<typeof Pressable>["onPress"];
  label: string;
};

function FinnTabButton({ accessibilityState, children, onPress, label }: FinnTabButtonProps) {
  const isSelected = Boolean(accessibilityState?.selected);

  return (
    <Pressable onPress={onPress} style={styles.button}>
      <View style={styles.stack}>
        <View style={[styles.iconWrap, isSelected ? styles.iconWrapActive : null]}>{children}</View>
        <Text style={[styles.label, isSelected ? styles.labelActive : null]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#050505" },
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: "#050505",
        tabBarInactiveTintColor: "#8b8b8b",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              color={color}
              size={size}
            />
          ),
          tabBarButton: (props) => <FinnTabButton {...props} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} color={color} size={size} />
          ),
          tabBarButton: (props) => <FinnTabButton {...props} label="Log" />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} color={color} size={size} />
          ),
          tabBarButton: (props) => <FinnTabButton {...props} label="Reports" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    height: 78,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "rgba(10, 10, 10, 0.96)",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    height: 60,
  },
  button: {
    flex: 1,
    justifyContent: "center",
  },
  stack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    backgroundColor: "#111111",
  },
  iconWrapActive: {
    backgroundColor: "#f4f4f4",
    borderColor: "#f4f4f4",
  },
  label: {
    color: "#8b8b8b",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  labelActive: {
    color: "#f4f4f4",
  },
});
