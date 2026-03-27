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
      <View style={[styles.segment, isSelected ? styles.segmentActive : null]}>
        <View style={styles.iconWrap}>{children}</View>
        <Text style={[styles.segmentLabel, isSelected ? styles.segmentLabelActive : null]}>
          {label}
        </Text>
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
    left: 20,
    right: 20,
    bottom: 22,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#0d0d0d",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    height: 54,
  },
  button: {
    flex: 1,
    justifyContent: "center",
  },
  segment: {
    minHeight: 48,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  segmentActive: {
    backgroundColor: "#f4f4f4",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    color: "#8b8b8b",
    fontSize: 14,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: "#050505",
  },
});
