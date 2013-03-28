# Copyright 2013 Mayank Lahiri
# mlahiri@gmail.com
# Released under the BSD License
"""Generates a nice HTML preview in the output/ subdirectory."""
import os

output_filename = None


def StartHTML(filename):
  '''Writes the header for the HTML preview file.'''
  global output_filename
  output_filename = filename
  fh_html_index = open(output_filename, 'w')
  fh_html_index.write('''
<!doctype html>
<html>
<head>
  <title>Maxstagram Randomly Generated Filter Preview</title>
  <style type="text/css">
  body { 
    font-family: Verdana, Arial; 
  }
  table {
    border: solid 1px black;
    font-size: 10px;
  }
  td {
    border: dashed 1px gray;
  }
  img {
    width: 320px;
    height: 320px;
  }
  </style>
  <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
  <script language="javascript">
    $(document).ready(function() {
      $('img').hover(function(ev) {
        if (ev.type === 'mouseenter') {
            newsrc = this.src.replace(/img-\S+?-/, '')
            $.data(this, 'oldsrc', this.src)
            this.src = newsrc
        }
        if (ev.type === 'mouseleave') {
            this.src = $.data(this, 'oldsrc')
        }
      })
    })
  </script>
</head>
<body>
<h1>Maxstagram Randomly Generated Filter Preview</h1>
<h2>Don't forget to check out <a href="http://maxstagram.com">Maxstagram.com</a> </h2>
<table>
  <tr>
    <td>#</td>
    <td>Parameters</td>
    <td>Images</td>
  </tr>
''')
  fh_html_index.close()

def WriteHTML(filter_idx, filterop, blendop, outputs, wall_time):
  global output_filename
  def tdgen(fn): return '''<td><a href="{fn}"><img src="{fn}"></a></td>'''.format(**locals())
  outputs = [ os.path.basename(i) for i in outputs ]
  table_row = '\n'.join([tdgen(i) for i in outputs ])
  fh_html_index = open(output_filename, 'a+')
  fh_html_index.write('''
  <tr>
    <td style="font-size: 24px">{filter_idx}</td>
    <td style="width:320px">
      <div style="font-weight: bold">Filter:</div>
      {filterop}
      <div style="font-weight: bold">Blend:</div>
      {blendop}
      <div style="font-weight: bold">Avg. walltime:</div>
      {wall_time} seconds/image
    </td>
    {table_row}
  </tr>
'''.format(**locals()))
  fh_html_index.close()

def EndHTML():
  global output_filename
  fh_html_index = open(output_filename, 'a+')
  fh_html_index.write('''
</table>
</body>
</html>
''')
  fh_html_index.close()
