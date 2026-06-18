import React, { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface ThinkingDotsProps {
  prefix?: string;
  style?: StyleProp<TextStyle>;
}

export default function ThinkingDots({
  prefix = 'Thinking',
  style,
}: ThinkingDotsProps) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDotCount(previousCount => (previousCount % 3) + 1);
    }, 450);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Text style={style}>
      {prefix}
      {[0, 1, 2].map(index => (
        <Text key={index} style={{ opacity: index < dotCount ? 1 : 0 }}>
          .
        </Text>
      ))}
    </Text>
  );
}
