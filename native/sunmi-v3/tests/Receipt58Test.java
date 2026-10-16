import com.volta.poslab.Receipt58;
public class Receipt58Test {
    public static void main(String[] args) throws Exception {
        for (String input : new String[] { "  FULL", "  DERECHA", "  IZQUIERDA", "  LADO 1: Barbacoa con nombre largo", "  SIN UBICACIÓN" }) {
            if (!Receipt58.isDetailHeading(input)) throw new AssertionError(input);
        }
        java.util.List<String> inputs = new java.util.ArrayList<>(java.util.Arrays.asList("  - SIN CEBOLLA", "  - Mozzarella di bufala de nombre largo: Doble", "  - Extra: Champiñones frescos y jamón: Simple", "Nota: Cortar en ocho por favor", "中文中文中文中文中文中文中文中文", "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"));
        if (args.length > 0) inputs.addAll(java.nio.file.Files.readAllLines(java.nio.file.Paths.get(args[0]), java.nio.charset.StandardCharsets.UTF_8));
        for (String input : inputs) {
            StringBuilder joined = new StringBuilder();
            for (String row : Receipt58.wrap(input)) {
                int width = row.codePoints().map(cp -> cp <= 255 || cp == 0x20ac ? 1 : 2).sum();
                if (width > 30) throw new AssertionError(row);
                joined.append(row.replace(" ", ""));
            }
            if (!joined.toString().equals(input.replace(" ", ""))) throw new AssertionError("Text lost: " + input);
        }
        System.out.println("Receipt58: headings, 30-column wrapping and text preservation passed");
    }
}
