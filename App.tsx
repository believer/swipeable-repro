import React from 'react'
import { Button, Dimensions, StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
  type NativeGesture,
  Touchable,
  useNativeGesture,
  usePanGesture,
} from 'react-native-gesture-handler'
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  LinearTransition,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

type DeleteActionProps = {
  isDeleting: boolean
  progress: SharedValue<number>
  onRemove: () => void
}

function DeleteAction({ isDeleting, progress, onRemove }: DeleteActionProps) {
  const width = useDerivedValue(() =>
    clamp(progress.get() * 64, 64, Number.POSITIVE_INFINITY),
  )

  const wrapAnimation = useAnimatedStyle(() => ({
    width: width.get(),
  }))

  // Start animation a bit delayed so it doesn't appear behind the swiped row
  const buttonAnimation = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0.2, 0.8],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.get(),
          [0.2, 1],
          [0.25, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
    width: width.get() - 16,
  }))

  return (
    <Animated.View style={[wrapAnimation, actionStyles.swipeButton]}>
      <Animated.View
        style={[buttonAnimation, { transformOrigin: 'right center' }]}
      >
        <Touchable
          activeOpacity={1}
          onPress={onRemove}
          style={actionStyles.swipeDelete}
        >
          <Animated.View
            accessible
            role="button"
            style={{
              alignItems: 'center',
              height: '100%',
              justifyContent: 'center',
              transitionDuration: 150,
              transitionProperty: 'width',
              width: isDeleting ? 48 : '100%',
            }}
          >
            <Text>De</Text>
          </Animated.View>
        </Touchable>
      </Animated.View>
    </Animated.View>
  )
}

const actionStyles = StyleSheet.create({
  swipeButton: {
    alignItems: 'flex-end',
    height: '100%',
    justifyContent: 'center',
    marginRight: 16,
  },
  swipeDelete: {
    backgroundColor: 'grey',
    borderRadius: 999,
    height: 48,
  },
})

const { width: windowWidth } = Dimensions.get('window')

type SwipeableRowProps = {
  children: React.ReactNode
  scrollGesture: NativeGesture
  onRemove: () => void
}

function SwipeableRow({
  children,
  scrollGesture,
  onRemove,
}: SwipeableRowProps) {
  const isLongDrag = useSharedValue(false)
  const isOpen = useSharedValue(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const rowRef = React.useRef<SwipeableMethods>(null)

  const threshold = windowWidth * 0.5

  const panGesture = usePanGesture({
    onDeactivate: () => {
      if (isLongDrag.get()) {
        rowRef.current?.close()
        isOpen.set(false)
        isLongDrag.set(false)

        scheduleOnRN(onRemove)
        scheduleOnRN(setIsDeleting, false)
      }
    },
    onUpdate: event => {
      // If we open the right swipe menu, release, and starting dragging
      // again the translation restarts at zero. Compensate with the size
      // of the right swipe menu to always trigger the automatic removal
      // at the same drag position.
      const translation = isOpen.get()
        ? Math.abs(event.translationX) + 80
        : Math.abs(event.translationX)

      if (translation >= threshold && isLongDrag.get() === false) {
        isLongDrag.set(true)
        scheduleOnRN(setIsDeleting, true)
      }

      if (translation < threshold && isLongDrag.get()) {
        isLongDrag.set(false)
        scheduleOnRN(setIsDeleting, false)
      }
    },
    simultaneousWith: scrollGesture,
    testID: 'swipe.row',
  })

  return (
    <GestureDetector gesture={panGesture}>
      <Swipeable
        onSwipeableClose={() => isOpen.set(false)}
        onSwipeableWillOpen={() => isOpen.set(true)}
        ref={rowRef}
        renderRightActions={progress => (
          <DeleteAction
            progress={progress}
            isDeleting={isDeleting}
            onRemove={onRemove}
          />
        )}
        rightThreshold={40}
        simultaneousWith={panGesture}
      >
        {children}
      </Swipeable>
    </GestureDetector>
  )
}

function Content() {
  const scrollGesture = useNativeGesture()
  const [items, setItems] = React.useState([
    { label: 'Test' },
    { label: 'Test 2' },
    { label: 'Test 3' },
  ])

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.container}>
        <GestureDetector gesture={scrollGesture}>
          <Animated.FlatList
            data={items}
            keyExtractor={item => item.label}
            itemLayoutAnimation={LinearTransition}
            contentContainerStyle={{ rowGap: 4 }}
            renderItem={({ item }) => {
              return (
                <SwipeableRow
                  scrollGesture={scrollGesture}
                  onRemove={() => {
                    setItems(prev =>
                      prev.filter(({ label }) => label !== item.label),
                    )
                  }}
                >
                  <View style={{ backgroundColor: 'lightgray', padding: 16 }}>
                    <Text>{item.label}</Text>
                  </View>
                </SwipeableRow>
              )
            }}
          />
        </GestureDetector>
        <Button
          title="Add item"
          onPress={() => {
            setItems(prev => [...prev, { label: `Test ${prev.length + 1}` }])
          }}
        />
      </View>
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Content />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
