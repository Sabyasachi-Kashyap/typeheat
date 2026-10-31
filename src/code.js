// Code tokens for the "code" mode. Each token is one space-separated unit, so a test drills
// symbols and identifiers in context. Indentation and line breaks are not modelled yet.
export const CODE_TOKENS = {
  python: `def return if elif else for while in not and or is None True False import from as class self
__init__ print(len( range(10): [i for i in x] {"key": value} x=[] d={} lambda: yield with open(path) as f:
try: except ValueError: raise finally: assert isinstance(x, int) -> str: def main(): if __name__ == "__main__":
sum(xs) / len(xs) x += 1 n //= 2 f"{name}!" *args **kwargs items.append(item) dict.get(key, 0)
os.path.join(a, b) json.dumps(obj, indent=2) sorted(d, key=lambda k: d[k]) enumerate(seq, start=1)
row[0][1:3] a == b != c >= d <= e 0x1F 3.14 1e-6 _private __dunder__ snake_case self.value = value`.split(/\s+/),
  js: `const let var function return if else for while of in new this null undefined true false
=> === !== && || ?? ?. async await import from export default class extends console.log(
document.querySelector("#app") addEventListener("click", () => {}) JSON.parse(text) Promise.all([])
arr.map(x => x * 2).filter(Boolean) {} [] () ; : , . ... obj?.prop ?? fallback
useState(0) useEffect(() => { return () => {}; }, []) export const x = 1; const { a, b } = props;
try { } catch (err) { } finally { } throw new Error("bad") typeof value === "string" i++ --count
(a, b) => a + b 0xFF 1_000_000 camelCase PascalCase SCREAMING_CASE =>{ return; }`.split(/\s+/),
};
