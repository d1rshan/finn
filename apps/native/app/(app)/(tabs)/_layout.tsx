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
      <View style={[styles.buttonInner, isSelected ? styles.buttonInnerActive : null]}>
        <View style={styles.iconWrap}>{children}</View>
        {isSelected ? <Text style={styles.buttonLabel}>{label}</Text> : null}
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
        tabBarInactiveTintColor: "#9b9b9b",
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
    height: 74,
    borderRadius: 28,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "rgba(10, 10, 10, 0.96)",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tabBarItem: {
    height: 54,
  },
  button: {
    flex: 1,
    justifyContent: "center",
  },
  buttonInner: {
    minHeight: 54,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  buttonInnerActive: {
    backgroundColor: "#f4f4f4",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "700",
  },
});
