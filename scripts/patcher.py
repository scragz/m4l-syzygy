"""Build the editable Max patch and an unfrozen native M4L instrument."""
from pathlib import Path
import json
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'device'
VERSION = dict(major=9, minor=0, revision=0, architecture='x64', modernui=1)
INK = [0.90, 0.91, 0.88, 1]
GOLD = [0.85, 0.72, 0.43, 1]
TEAL = [0.40, 0.78, 0.71, 1]
BG = [0.071, 0.086, 0.09, 1]
BOXES, LINES, PARAMETERS = [], [], {}


def box(name, kind, rect, **attrs):
    b = dict(id=name, maxclass=kind, patching_rect=rect, **attrs)
    BOXES.append({'box': b})
    return name


def obj(name, text, x, y, ni=1, no=1, **attrs):
    return box(name, 'newobj', [x, y, 150, 22], text=text,
               numinlets=ni, numoutlets=no, **attrs)


def wire(src, dst, outlet=0, inlet=0):
    LINES.append({'patchline': dict(source=[src, outlet], destination=[dst, inlet])})


def parameter(key, label, lo, hi, initial, rect=None, kind='live.dial', unit=5, enum=None, **attrs):
    i = len(PARAMETERS)
    value = dict(parameter_longname=label, parameter_shortname=label,
                 parameter_type=2 if enum else 0, parameter_mmin=lo,
                 parameter_mmax=hi, parameter_initial=[initial],
                 parameter_initial_enable=1, parameter_unitstyle=unit)
    if enum:
        value['parameter_enum'] = enum
    present = dict(presentation=1, presentation_rect=rect) if rect else {}
    box(key, kind, [30 + (i % 6) * 165, 250 + (i // 6) * 110, 54, 50],
        varname=key, parameter_enable=1,
        saved_attribute_attributes={'valueof': value},
        numinlets=1, numoutlets=3 if kind=='live.menu' else 2,
        **present, **attrs)
    PARAMETERS[key] = [label, label, 0]
    obj('send-'+key, 'prepend '+key, 30+(i%6)*165, 305+(i//6)*110)
    wire(key, 'send-'+key)
    wire('send-'+key, 'control')


def dial(key, label, lo, hi, initial, x, y, unit=5, hint='', **attrs):
    if unit == 5:
        lo, hi, initial = lo*100, hi*100, initial*100
    parameter(key, label, lo, hi, initial, [x,y,52,51], unit=unit,
              appearance=0, activefgdialcolor=GOLD, activeneedlecolor=INK,
              textcolor=INK, textcolor2=[0.59,0.65,0.64,1],
              activedialcolor=[0.21,0.25,0.25,1], fontsize=9,
              annotation=hint, **attrs)


def button(key, text, rect, toggle=False, initial=0, color=TEAL):
    parameter(key, key.title(), 0, 1, initial, rect, kind='live.text', unit=9,
              enum=['Off','On'], mode=1 if toggle else 0,
              text=text, texton=text, fontsize=9, rounded=3,
              bgcolor=[0.16,0.20,0.20,1], bgoncolor=color,
              textcolor=INK, textoncolor=BG)
    if not toggle:
        # Keep Live's parameter-backed widget enabled, but don't expose actions
        # for automation or emit an action during parameter initialization.
        b = next(b['box'] for b in BOXES if b['box']['id']==key)
        b['active'] = 1
        b['saved_attribute_attributes']['valueof']['parameter_invisible'] = 1
        b['saved_attribute_attributes']['valueof']['parameter_initial_enable'] = 0
        LINES[:] = [l for l in LINES if l['patchline']['source'][0] != key]
        box('msg-'+key, 'message', [1210,300+len(BOXES)*2,65,22], text=key)
        # live.text in button mode emits bang, not the toggle's integer 1.
        wire(key, 'msg-'+key)
        wire('msg-'+key, 'control')


