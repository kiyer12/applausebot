var ZoomInvite = {
    parse: function(txt) {
      var lines = txt.split("\n");
      if (lines.length < 5) {
        return "";
      }
      var nextLineIsNumber = false;
      var number = "";
      for(var i = 0; i < lines.length; i++) {
        var line = lines[i];

        if (nextLineIsNumber) {
          number = lines[i];
          break;
        }
        if (line.startsWith("One tap mobile")) {
          nextLineIsNumber = true;
        }
      }

      var numberParts = number.split(" ");
      return numberParts[0];
    }
};

export { ZoomInvite as default };