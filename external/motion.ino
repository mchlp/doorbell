
#define PIN 2

int last = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIN, INPUT);
  Serial.println(0);
}

void loop() {
  int state = digitalRead(PIN);
  if (state != last) {
    last = state;
    Serial.println(state);
  }
  delay(1);
}
